import 'server-only';

import {
  getMerchizeFulfillmentOpsPrisma,
  isMerchizeFulfillmentOpsDatabaseConfigured,
} from '@/lib/prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOpsPrisma';
import { syncMerchizeFulfillmentOperationalSnapshots } from './syncMerchizeFulfillmentOperationalSnapshots';
import { syncMerchizeFulfillmentOrder } from './syncMerchizeFulfillmentOrder';
import { runMerchizeProductionReadinessChecks } from './runMerchizeProductionReadinessChecks';
import { listMerchizeExternalOrdersDetail } from './merchizeClient';
import { holdLookupSelect, holdLookupVersion, reconcileMerchizeOrderHolds } from './merchizeOrderHold';
import {
  MERCHIZE_CANCELLATION_STATUSES,
  MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS,
} from './status';
import { safeLogErrorMessage } from './redaction';
import { VERIFIED_MERCHIZE_DELIVERY_STATUS } from './customerTracking';
import { notifyMerchizeLifecycle } from './notifyMerchizeLifecycle';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import {
  ADMIN_NOTIFICATION_SEVERITY,
  enqueueAdminRecoveryNotification,
  sendPendingAdminRecoveryNotificationsForOrder,
} from '@/lib/paypal/txLedger/adminNotificationOutbox';
import {
  assertAlignedShopOpsDataTarget,
  assertShopOpsMutationAllowed,
} from '@/lib/prisma/shop/shopOpsDataTarget';

const MAX_BATCH_SIZE = 25;
const REPEATED_FAILURE_THRESHOLD = 3;
// Legacy "delivered" values may describe only the first package. Recheck those rows.
const TERMINAL_DELIVERY_STATUSES = [
  VERIFIED_MERCHIZE_DELIVERY_STATUS,
  ...MERCHIZE_CANCELLATION_STATUSES,
] as const;

async function notifyRepeatedLifecycleFailure(args: {
  orderToken: string;
  failedActions: string[];
}) {
  if (args.failedActions.length === 0) return false;

  const prisma = getMerchizeFulfillmentOpsPrisma();
  const repeatedActions: string[] = [];
  for (const action of args.failedActions) {
    const failureCount = await prisma.merchizeFulfillmentSyncAttempt.count({
      where: {
        orderToken: args.orderToken,
        action,
        status: 'failed',
      },
    });
    if (failureCount >= REPEATED_FAILURE_THRESHOLD) repeatedActions.push(action);
  }
  if (repeatedActions.length === 0) return false;

  const row = await paypalTxLedger.paypalIntent.findUnique({
    where: { orderToken: args.orderToken },
    select: {
      paypalOrderId: true,
      customerName: true,
      customerEmail: true,
      receiptLink: true,
      status: true,
    },
  });
  if (!row) return false;

  const errorMessage = 'Merchize operational snapshots failed repeatedly after production release.';
  await enqueueAdminRecoveryNotification({
    orderToken: args.orderToken,
    paypalOrderId: row.paypalOrderId,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    receiptLink: row.receiptLink,
    ledgerStatus: row.status,
    errorCode: 'MERCHIZE_LIFECYCLE_SYNC_REPEATED_FAILURE',
    errorMessage,
    issueSummary: [
      errorMessage,
      `Repeated snapshot actions: ${repeatedActions.join(', ')}.`,
      'Payment and verified production-release state were not replayed or rolled back.',
    ],
    severity: ADMIN_NOTIFICATION_SEVERITY.WARNING,
  });
  await sendPendingAdminRecoveryNotificationsForOrder(args.orderToken).catch(() => undefined);
  return true;
}

async function notifyLifecycleAttention(args: {
  orderToken: string;
  blockers: Array<{ code: string; message: string; retryable: boolean }>;
}) {
  const actionable = args.blockers.filter((blocker) => !blocker.retryable);
  if (actionable.length === 0) return false;

  const row = await paypalTxLedger.paypalIntent.findUnique({
    where: { orderToken: args.orderToken },
    select: {
      paypalOrderId: true,
      customerName: true,
      customerEmail: true,
      receiptLink: true,
      status: true,
    },
  });
  if (!row) return false;

  await enqueueAdminRecoveryNotification({
    orderToken: args.orderToken,
    paypalOrderId: row.paypalOrderId,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    receiptLink: row.receiptLink,
    ledgerStatus: row.status,
    errorCode: 'MERCHIZE_LIFECYCLE_ATTENTION_REQUIRED',
    errorMessage: 'Merchize reported an operational issue after production release.',
    issueSummary: actionable.map((blocker) => blocker.message),
    severity: ADMIN_NOTIFICATION_SEVERITY.WARNING,
  });
  await sendPendingAdminRecoveryNotificationsForOrder(args.orderToken).catch(() => undefined);
  return true;
}

export async function runMerchizeFulfillmentLifecycleScanner(
  args: {
    dryRun?: boolean;
    batchSize?: number;
    minAgeMinutes?: number;
  } = {},
) {
  const dryRun = args.dryRun ?? false;
  if (dryRun) {
    assertAlignedShopOpsDataTarget();
  } else {
    assertShopOpsMutationAllowed();
  }

  const batchSize = Math.min(Math.max(Math.floor(args.batchSize ?? 10), 1), MAX_BATCH_SIZE);
  const minAgeMinutes = Math.max(Math.floor(args.minAgeMinutes ?? 15), 1);
  const scannedAt = new Date();

  if (!isMerchizeFulfillmentOpsDatabaseConfigured()) {
    return {
      ok: true,
      enabled: false,
      dryRun,
      scannedAt: scannedAt.toISOString(),
      candidates: [],
      results: [],
    };
  }

  const cutoff = new Date(scannedAt.getTime() - minAgeMinutes * 60_000);
  const prisma = getMerchizeFulfillmentOpsPrisma();
  const pendingRelease = await prisma.merchizeFulfillmentOrder.findMany({
    where: {
      merchizeOrderId: { not: null },
      duplicateDetectedAt: null,
      pushVerifiedAt: null,
      AND: [
        { OR: [{ merchizeIsDeleted: null }, { merchizeIsDeleted: false }] },
        { OR: [{ lastLookupAt: null }, { lastLookupAt: { lte: cutoff } }] },
        { OR: [{ productionGateStatus: null }, { productionGateStatus: { not: 'push_verified' } }] },
        { OR: [{ deliveryStatus: null }, { deliveryStatus: { notIn: [...TERMINAL_DELIVERY_STATUSES] } }] },
      ],
    },
    orderBy: [{ lastLookupAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
    take: batchSize,
    select: holdLookupSelect,
  });
  const holdSync = { candidates: pendingRelease.length, saved: 0, unavailable: 0 };
  if (!dryRun && pendingRelease.length) {
    try {
      const observations = await reconcileMerchizeOrderHolds(pendingRelease, {
        read: listMerchizeExternalOrdersDetail,
        save: async (order, data) => {
          const write = await prisma.merchizeFulfillmentOrder.updateMany({
            where: { ...holdLookupVersion(order), duplicateDetectedAt: null },
            data,
          });
          return write.count === 1;
        },
      });
      holdSync.saved = observations.filter((observation) => observation.saved).length;
      holdSync.unavailable = observations.filter((observation) => !observation.state).length;
    } catch {
      holdSync.unavailable = pendingRelease.length;
    }
  }
  const rows = await prisma.merchizeFulfillmentOrder.findMany({
    where: {
      merchizeOrderId: { not: null },
      productionGateStatus: MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_VERIFIED,
      AND: [
        { OR: [{ merchizeIsDeleted: null }, { merchizeIsDeleted: false }] },
        { OR: [{ lastProgressSyncAt: null }, { lastProgressSyncAt: { lte: cutoff } }] },
        {
          OR: [
            { deliveryStatus: null },
            { deliveryStatus: { notIn: [...TERMINAL_DELIVERY_STATUSES] } },
          ],
        },
      ],
    },
    orderBy: [{ lastProgressSyncAt: 'asc' }, { updatedAt: 'asc' }],
    take: batchSize,
    select: { orderToken: true, productionGateStatus: true, lastProgressSyncAt: true },
  });
  const candidates = rows.map((row) => ({
    orderToken: row.orderToken,
    productionGateStatus: row.productionGateStatus,
    lastProgressSyncAt: row.lastProgressSyncAt?.toISOString() ?? null,
  }));
  const results: Array<{
    orderToken: string;
    ok: boolean;
    attempted: string[];
    failedActions: string[];
    error?: string;
    adminEscalated?: boolean;
    attentionAlerted?: boolean;
    readinessStatus?: string;
  }> = [];

  if (!dryRun) {
    for (const candidate of candidates) {
      try {
        const detailSync = await syncMerchizeFulfillmentOrder(candidate.orderToken);
        if (detailSync.ok && detailSync.fulfillmentCanceled) {
          results.push({
            orderToken: candidate.orderToken,
            ok: true,
            attempted: ['canonical_order_detail'],
            failedActions: [],
            readinessStatus: 'cancelled',
          });
          continue;
        }
        const readiness = await runMerchizeProductionReadinessChecks(candidate.orderToken);
        const snapshots = await syncMerchizeFulfillmentOperationalSnapshots(candidate.orderToken, {
          includeInvoice: false,
        });
        const snapshotFailedActions = snapshots.failed.map((failure) => failure.action);
        const failedActions = [
          ...(!detailSync.ok ? ['canonical_order_detail'] : []),
          ...(!readiness.ok ? ['production_readiness'] : []),
          ...snapshotFailedActions,
        ];
        const adminEscalated = snapshots.ok
          ? false
          : await notifyRepeatedLifecycleFailure({
              orderToken: candidate.orderToken,
              failedActions: snapshotFailedActions,
            });
        const attentionAlerted = readiness.ok
          ? await notifyLifecycleAttention({
              orderToken: candidate.orderToken,
              blockers: readiness.readiness.blockers,
            })
          : false;
        if (detailSync.ok && readiness.ok) {
          await notifyMerchizeLifecycle(candidate.orderToken, scannedAt);
        }
        results.push({
          orderToken: candidate.orderToken,
          ok: detailSync.ok && readiness.ok && snapshots.ok,
          attempted: ['canonical_order_detail', 'production_readiness', ...snapshots.attempted],
          failedActions,
          adminEscalated,
          attentionAlerted,
          readinessStatus: readiness.ok ? readiness.readiness.status : 'check_failed',
        });
      } catch (error) {
        results.push({
          orderToken: candidate.orderToken,
          ok: false,
          attempted: [],
          failedActions: [],
          error: safeLogErrorMessage(error),
        });
      }
    }
  }

  return {
    ok: holdSync.unavailable === 0 && results.every((result) => result.ok),
    enabled: true,
    dryRun,
    scannedAt: scannedAt.toISOString(),
    minAgeMinutes,
    batchSize,
    candidates,
    results,
    holdSync,
  };
}

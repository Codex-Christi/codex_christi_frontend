import 'server-only';

import {
  getMerchizeFulfillmentOpsPrisma,
  isMerchizeFulfillmentOpsDatabaseConfigured,
} from '@/lib/prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOpsPrisma';
import { syncMerchizeFulfillmentOperationalSnapshots } from './syncMerchizeFulfillmentOperationalSnapshots';
import { syncMerchizeFulfillmentOrder } from './syncMerchizeFulfillmentOrder';
import { runMerchizeProductionReadinessChecks } from './runMerchizeProductionReadinessChecks';
import { MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS } from './status';
import { safeLogErrorMessage } from './redaction';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import {
  ADMIN_NOTIFICATION_SEVERITY,
  enqueueAdminRecoveryNotification,
  sendPendingAdminRecoveryNotificationsForOrder,
} from '@/lib/paypal/txLedger/adminNotificationOutbox';

const MAX_BATCH_SIZE = 25;
const REPEATED_FAILURE_THRESHOLD = 3;
const TERMINAL_DELIVERY_STATUSES = ['delivered', 'cancelled', 'canceled'] as const;

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
  const rows = await prisma.merchizeFulfillmentOrder.findMany({
    where: {
      merchizeOrderId: { not: null },
      merchizeIsDeleted: { not: true },
      productionGateStatus: MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_VERIFIED,
      AND: [
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
    ok: results.every((result) => result.ok),
    enabled: true,
    dryRun,
    scannedAt: scannedAt.toISOString(),
    minAgeMinutes,
    batchSize,
    candidates,
    results,
  };
}

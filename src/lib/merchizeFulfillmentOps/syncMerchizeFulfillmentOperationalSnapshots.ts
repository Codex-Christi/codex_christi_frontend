import 'server-only';

import {
  getMerchizeFulfillmentOpsPrisma,
  isMerchizeFulfillmentOpsDatabaseConfigured,
} from '@/lib/prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOpsPrisma';
import {
  getMerchizeExternalOrderInvoice,
  getMerchizeExternalOrderProgress,
  getMerchizeExternalOrderTracking,
  MerchizeApiError,
  type MerchizeExternalOrderReference,
} from './merchizeClient';
import {
  asRecord,
  getPath,
  summarizeProviderRequest,
  summarizeProviderResponse,
  toOptionalPrismaJson,
} from './merchizeMapper';
import { safeLogErrorMessage } from './redaction';
import { MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS } from './status';

type SnapshotAction =
  | 'external_order_progress'
  | 'external_order_tracking'
  | 'external_order_invoice';

type SnapshotResult = {
  ok: boolean;
  orderToken: string;
  attempted: SnapshotAction[];
  failed: Array<{ action: SnapshotAction; errorCode: string; errorMessage: string }>;
};

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getFirstDataRecord(payload: unknown) {
  const data = getPath(payload, ['data']);
  if (Array.isArray(data)) return asRecord(data[0]);
  return asRecord(data);
}

function summarizeProgressStatus(payload: unknown) {
  const data = getFirstDataRecord(payload);
  const progress = data?.order_progress;
  if (!Array.isArray(progress)) return asString(data?.status);

  const pending = progress.find((event) => {
    const status = asString(asRecord(event)?.status)?.toLowerCase();
    return status && status !== 'done';
  });
  const pendingRecord = asRecord(pending);
  if (pendingRecord) {
    const event = asString(pendingRecord.event);
    const status = asString(pendingRecord.status);
    return [event, status].filter(Boolean).join(':') || status || event;
  }

  return 'done';
}

function summarizeDeliveryStatus(payload: unknown) {
  const data = getFirstDataRecord(payload);
  if (!data) return null;

  const packageStatus = asString(data.status);
  if (packageStatus) return packageStatus;

  const packageProgresses = data.package_progresses;
  if (!Array.isArray(packageProgresses)) return null;

  for (const packageProgress of packageProgresses) {
    const progress = asRecord(packageProgress)?.progress;
    if (!Array.isArray(progress)) continue;
    const current = progress.find((event) => {
      const status = asString(asRecord(event)?.status)?.toLowerCase();
      return status && status !== 'done';
    });
    const event = asString(asRecord(current)?.event);
    if (event) return event;
  }

  return null;
}

function summarizeCostReviewStatus(payload: unknown) {
  const data = getFirstDataRecord(payload);
  const fulfillmentCost = asRecord(data?.fulfillment_cost);
  return asString(fulfillmentCost?.status);
}

function getSnapshotError(error: unknown) {
  if (error instanceof MerchizeApiError) {
    return {
      code: error.code,
      message: error.message,
      responseSummary: error.responseSummary,
    };
  }

  return {
    code: 'MERCHIZE_OPERATIONAL_SNAPSHOT_FAILED',
    message: safeLogErrorMessage(error),
    responseSummary: null,
  };
}

function buildReference(order: {
  merchizeExternalOrderNumber: string;
  merchizeOrderCode: string | null;
  merchizeIdentifier: string | null;
}): MerchizeExternalOrderReference {
  if (order.merchizeExternalOrderNumber) {
    return {
      externalNumber: order.merchizeExternalOrderNumber,
      identifier: order.merchizeIdentifier,
    };
  }

  return {
    code: order.merchizeOrderCode ?? '',
    identifier: order.merchizeIdentifier,
  };
}

export async function syncMerchizeFulfillmentOperationalSnapshots(
  orderToken: string,
): Promise<SnapshotResult> {
  if (!isMerchizeFulfillmentOpsDatabaseConfigured()) {
    return {
      ok: false,
      orderToken,
      attempted: [],
      failed: [
        {
          action: 'external_order_progress',
          errorCode: 'MERCHIZE_FULFILLMENT_OPS_DB_NOT_CONFIGURED',
          errorMessage: 'Merchize Fulfillment Ops database is not configured.',
        },
      ],
    };
  }

  const prisma = getMerchizeFulfillmentOpsPrisma();
  const order = await prisma.merchizeFulfillmentOrder.findFirst({
    where: { orderToken },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      orderToken: true,
      merchizeExternalOrderNumber: true,
      merchizeOrderCode: true,
      merchizeIdentifier: true,
    },
  });

  if (!order) {
    return {
      ok: false,
      orderToken,
      attempted: [],
      failed: [
        {
          action: 'external_order_progress',
          errorCode: 'MERCHIZE_FULFILLMENT_OPS_ORDER_NOT_FOUND',
          errorMessage: 'Merchize Fulfillment Ops order was not found.',
        },
      ],
    };
  }

  const orderRow = order;
  const reference = buildReference(orderRow);
  const requestSummary = {
    code: 'code' in reference ? (reference.code ?? '') : '',
    external_number: 'externalNumber' in reference ? reference.externalNumber : '',
    identifier: reference.identifier ?? '',
  };
  const attempted: SnapshotAction[] = [];
  const failed: SnapshotResult['failed'] = [];

  async function runSnapshot(
    action: SnapshotAction,
    request: () => Promise<unknown>,
    persist: (payload: unknown) => Promise<void>,
  ) {
    attempted.push(action);
    const attempt = await prisma.merchizeFulfillmentSyncAttempt.create({
      data: {
        merchizeFulfillmentOrderId: orderRow.id,
        orderToken: orderRow.orderToken,
        action,
        status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.RUNNING,
        requestSummary: summarizeProviderRequest(requestSummary),
      },
    });

    try {
      const payload = await request();
      await persist(payload);
      await prisma.merchizeFulfillmentSyncAttempt.update({
        where: { id: attempt.id },
        data: {
          status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.SUCCEEDED,
          responseSummary: summarizeProviderResponse(payload),
          finishedAt: new Date(),
        },
      });
    } catch (error) {
      const snapshotError = getSnapshotError(error);
      failed.push({
        action,
        errorCode: snapshotError.code,
        errorMessage: snapshotError.message,
      });
      await prisma.merchizeFulfillmentSyncAttempt.update({
        where: { id: attempt.id },
        data: {
          status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.FAILED,
          errorCode: snapshotError.code,
          errorMessage: snapshotError.message,
          responseSummary: summarizeProviderResponse(snapshotError.responseSummary),
          finishedAt: new Date(),
        },
      });
    }
  }

  await runSnapshot(
    'external_order_progress',
    () => getMerchizeExternalOrderProgress(reference),
    async (payload) => {
      await prisma.merchizeFulfillmentOrder.update({
        where: { id: orderRow.id },
        data: {
          merchizeProgressPayload: toOptionalPrismaJson(payload),
          progressStatus: summarizeProgressStatus(payload),
          lastProgressSyncAt: new Date(),
        },
      });
    },
  );

  await runSnapshot(
    'external_order_tracking',
    () => getMerchizeExternalOrderTracking(reference),
    async (payload) => {
      await prisma.merchizeFulfillmentOrder.update({
        where: { id: orderRow.id },
        data: {
          merchizeTrackingPayload: toOptionalPrismaJson(payload),
          deliveryStatus: summarizeDeliveryStatus(payload),
          lastTrackingSyncAt: new Date(),
        },
      });
    },
  );

  await runSnapshot(
    'external_order_invoice',
    () => getMerchizeExternalOrderInvoice(reference),
    async (payload) => {
      await prisma.merchizeFulfillmentOrder.update({
        where: { id: orderRow.id },
        data: {
          merchizeFulfillmentCostPayload: toOptionalPrismaJson(payload),
          costReviewStatus: summarizeCostReviewStatus(payload),
          lastCostCheckAt: new Date(),
        },
      });
    },
  );

  return {
    ok: failed.length === 0,
    orderToken,
    attempted,
    failed,
  };
}

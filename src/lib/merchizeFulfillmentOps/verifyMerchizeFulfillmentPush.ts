import 'server-only';

import {
  getMerchizeInDepthOrderDetail,
  getMerchizeOrderHistory,
  getMerchizeOrderProgress,
  getMerchizeSendToFulfillmentDate,
  MerchizeApiError,
} from './merchizeClient';
import {
  getMerchizeFulfillmentOpsPrisma,
  isMerchizeFulfillmentOpsDatabaseConfigured,
} from '@/lib/prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOpsPrisma';
import {
  asRecord,
  summarizeProviderRequest,
  summarizeProviderResponse,
  toOptionalPrismaJson,
} from './merchizeMapper';
import { safeLogErrorMessage } from './redaction';
import {
  MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS,
  MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS,
  MERCHIZE_FULFILLMENT_SYNC_STATUS,
} from './status';
import { refreshPaidOrderRecoveryProjectionSafely } from '@/lib/paypal/txLedger/paidOrderRecoveryProjection';

const DEFAULT_VERIFICATION_DELAYS_MS = [0, 1_500, 3_000] as const;

export type MerchizePushVerificationResult =
  | { status: 'verified'; orderToken: string; providerPushProgress: string }
  | { status: 'pending'; orderToken: string; providerPushProgress: string | null }
  | {
      status: 'failed';
      orderToken: string;
      providerPushProgress: string | null;
      errorCode: string;
      errorMessage: string;
    };

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function getDataRecord(payload: unknown) {
  return asRecord(asRecord(payload)?.data) ?? asRecord(payload);
}

function containsManualPushFailure(value: unknown, depth = 0): boolean {
  if (depth > 6 || value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    return (
      normalized.includes('manual_push_fulfillment_failed') ||
      normalized.includes('push_to_fulfillment_failed')
    );
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsManualPushFailure(item, depth + 1));
  }
  const record = asRecord(value);
  return record
    ? Object.values(record).some((item) => containsManualPushFailure(item, depth + 1))
    : false;
}

function classifyEvidence(detail: unknown, sendToFulfillment: unknown, history: unknown) {
  const detailData = getDataRecord(detail);
  const sendData = getDataRecord(sendToFulfillment);
  const progress = asString(detailData?.push_to_fulfillment_progress)?.toLowerCase() ?? null;

  if (
    progress === 'pushed' ||
    asBoolean(sendData?.pushed) === true ||
    asBoolean(sendData?.is_pushed) === true
  ) {
    return { state: 'verified' as const, progress: progress ?? 'pushed' };
  }
  if (
    progress === 'failed' ||
    asBoolean(sendData?.is_failed) === true ||
    containsManualPushFailure(history)
  ) {
    return { state: 'failed' as const, progress: progress ?? 'failed' };
  }

  return { state: 'pending' as const, progress };
}

function wait(ms: number) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function verifyMerchizeFulfillmentPush(
  orderToken: string,
  options: { retryDelaysMs?: readonly number[] } = {},
): Promise<MerchizePushVerificationResult> {
  if (!isMerchizeFulfillmentOpsDatabaseConfigured()) {
    return {
      status: 'failed',
      orderToken,
      providerPushProgress: null,
      errorCode: 'MERCHIZE_FULFILLMENT_OPS_DB_NOT_CONFIGURED',
      errorMessage: 'Merchize Fulfillment Ops database is not configured.',
    };
  }

  const prisma = getMerchizeFulfillmentOpsPrisma();
  const order = await prisma.merchizeFulfillmentOrder.findFirst({
    where: { orderToken },
    orderBy: { updatedAt: 'desc' },
  });
  if (!order?.merchizeOrderId) {
    return {
      status: 'failed',
      orderToken,
      providerPushProgress: null,
      errorCode: 'MERCHIZE_ORDER_ID_MISSING',
      errorMessage: 'Merchize platform order ID is missing before push verification.',
    };
  }

  const attempt = await prisma.merchizeFulfillmentSyncAttempt.create({
    data: {
      merchizeFulfillmentOrderId: order.id,
      orderToken,
      action: 'push_verification',
      status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.RUNNING,
      requestSummary: summarizeProviderRequest({ merchizeOrderId: order.merchizeOrderId }),
    },
  });
  const delays = options.retryDelaysMs ?? DEFAULT_VERIFICATION_DELAYS_MS;
  let detail: unknown = null;
  let sendToFulfillment: unknown = null;
  let history: unknown = null;
  let progress: unknown = null;
  let evidence: ReturnType<typeof classifyEvidence> = { state: 'pending', progress: null };
  let lastError: unknown = null;

  for (const delayMs of delays) {
    await wait(delayMs);
    try {
      [detail, sendToFulfillment, history, progress] = await Promise.all([
        getMerchizeInDepthOrderDetail(order.merchizeOrderId),
        getMerchizeSendToFulfillmentDate(order.merchizeOrderId),
        getMerchizeOrderHistory(order.merchizeOrderId),
        getMerchizeOrderProgress(order.merchizeOrderId),
      ]);
      evidence = classifyEvidence(detail, sendToFulfillment, history);
      lastError = null;
      if (evidence.state === 'verified') break;
    } catch (error) {
      lastError = error;
    }
  }

  const verifiedAt = new Date();
  if (evidence.state === 'verified') {
    await prisma.$transaction(async (tx) => {
      await tx.merchizeFulfillmentOrder.update({
        where: { id: order.id },
        data: {
          syncStatus: MERCHIZE_FULFILLMENT_SYNC_STATUS.PUSH_VERIFIED,
          productionGateStatus: MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_VERIFIED,
          providerPushProgress: evidence.progress,
          releasedToProductionAt: order.releasedToProductionAt ?? verifiedAt,
          pushVerifiedAt: order.pushVerifiedAt ?? verifiedAt,
          merchizeInDepthOrderDetailPayload: toOptionalPrismaJson(detail),
          merchizeSendToFulfillmentPayload: toOptionalPrismaJson(sendToFulfillment),
          merchizeHistoryPayload: toOptionalPrismaJson(history),
          merchizeProgressPayload: toOptionalPrismaJson(progress),
          lastProgressSyncAt: verifiedAt,
          lastHistorySyncAt: verifiedAt,
          lastSyncErrorCode: null,
          lastSyncErrorMessage: null,
        },
      });
      await tx.merchizeFulfillmentSyncAttempt.update({
        where: { id: attempt.id },
        data: {
          status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.SUCCEEDED,
          responseSummary: summarizeProviderResponse({
            success: true,
            status: evidence.progress,
            message: 'Merchize push was verified from provider order state.',
          }),
          finishedAt: verifiedAt,
        },
      });
    });
    await refreshPaidOrderRecoveryProjectionSafely(orderToken);
    return { status: 'verified', orderToken, providerPushProgress: evidence.progress };
  }

  if (evidence.state === 'failed') {
    const errorMessage =
      'Merchize accepted the push command but the provider order entered a failed push state.';
    await prisma.$transaction(async (tx) => {
      await tx.merchizeFulfillmentOrder.update({
        where: { id: order.id },
        data: {
          syncStatus: MERCHIZE_FULFILLMENT_SYNC_STATUS.PUSH_FAILED,
          productionGateStatus: MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_FAILED,
          providerPushProgress: evidence.progress,
          merchizeInDepthOrderDetailPayload: toOptionalPrismaJson(detail),
          merchizeSendToFulfillmentPayload: toOptionalPrismaJson(sendToFulfillment),
          merchizeHistoryPayload: toOptionalPrismaJson(history),
          merchizeProgressPayload: toOptionalPrismaJson(progress),
          lastProgressSyncAt: verifiedAt,
          lastHistorySyncAt: verifiedAt,
          lastSyncErrorCode: 'MERCHIZE_PUSH_PROVIDER_STATE_FAILED',
          lastSyncErrorMessage: errorMessage,
        },
      });
      await tx.merchizeFulfillmentSyncAttempt.update({
        where: { id: attempt.id },
        data: {
          status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.FAILED,
          errorCode: 'MERCHIZE_PUSH_PROVIDER_STATE_FAILED',
          errorMessage,
          responseSummary: summarizeProviderResponse({
            success: false,
            status: evidence.progress,
            message: errorMessage,
          }),
          finishedAt: verifiedAt,
        },
      });
    });
    await refreshPaidOrderRecoveryProjectionSafely(orderToken);
    return {
      status: 'failed',
      orderToken,
      providerPushProgress: evidence.progress,
      errorCode: 'MERCHIZE_PUSH_PROVIDER_STATE_FAILED',
      errorMessage,
    };
  }

  const fetchError = lastError
    ? lastError instanceof MerchizeApiError
      ? lastError.message
      : safeLogErrorMessage(lastError)
    : null;
  const pendingMessage = fetchError
    ? 'Merchize push verification could not read a final provider state yet.'
    : 'Merchize push is acknowledged but has not reached a final provider state yet.';
  await prisma.$transaction(async (tx) => {
    await tx.merchizeFulfillmentOrder.update({
      where: { id: order.id },
      data: {
        syncStatus: MERCHIZE_FULFILLMENT_SYNC_STATUS.PUSH_VERIFICATION_PENDING,
        productionGateStatus:
          MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_VERIFICATION_PENDING,
        providerPushProgress: evidence.progress,
        merchizeInDepthOrderDetailPayload: toOptionalPrismaJson(detail),
        merchizeSendToFulfillmentPayload: toOptionalPrismaJson(sendToFulfillment),
        merchizeHistoryPayload: toOptionalPrismaJson(history),
        merchizeProgressPayload: toOptionalPrismaJson(progress),
        lastProgressSyncAt: verifiedAt,
        lastHistorySyncAt: verifiedAt,
        lastSyncErrorCode: 'MERCHIZE_PUSH_VERIFICATION_PENDING',
        lastSyncErrorMessage: null,
      },
    });
    await tx.merchizeFulfillmentSyncAttempt.update({
      where: { id: attempt.id },
      data: {
        status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.SKIPPED,
        errorCode: 'MERCHIZE_PUSH_VERIFICATION_PENDING',
        errorMessage: pendingMessage,
        responseSummary: summarizeProviderResponse({
          success: true,
          status: evidence.progress ?? 'pending',
          message: pendingMessage,
        }),
        finishedAt: verifiedAt,
      },
    });
  });
  await refreshPaidOrderRecoveryProjectionSafely(orderToken);
  return { status: 'pending', orderToken, providerPushProgress: evidence.progress };
}

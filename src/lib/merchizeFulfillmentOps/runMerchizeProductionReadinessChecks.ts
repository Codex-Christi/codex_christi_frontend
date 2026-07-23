import 'server-only';

import {
  getMerchizeAddressSuggestion,
  getMerchizeFulfillmentCostInvoice,
  getMerchizeInDepthOrderDetail,
  getMerchizeRequireAttention,
  getMerchizeSendToFulfillmentDate,
  getMerchizeUnfulfilledItems,
  MerchizeApiError,
} from './merchizeClient';
import {
  getMerchizeFulfillmentOpsPrisma,
  isMerchizeFulfillmentOpsDatabaseConfigured,
} from '@/lib/prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOpsPrisma';
import {
  summarizeProviderRequest,
  summarizeProviderResponse,
  toOptionalPrismaJson,
  toPrismaJson,
} from './merchizeMapper';
import { classifyMerchizeProductionReadiness } from './productionReadiness';
import { safeLogErrorMessage } from './redaction';
import {
  MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS,
  MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS,
  MERCHIZE_FULFILLMENT_SYNC_STATUS,
} from './status';
import { refreshPaidOrderRecoveryProjectionSafely } from '@/lib/paypal/txLedger/paidOrderRecoveryProjection';

type ReadinessOptions = {
  allowStaleOrderManualRelease?: boolean;
};

export type MerchizeProductionReadinessCheckResult =
  | {
      ok: true;
      orderToken: string;
      merchizeOrderId: string;
      pushAcknowledgedAt: Date | null;
      pushVerifiedAt: Date | null;
      readiness: ReturnType<typeof classifyMerchizeProductionReadiness>;
    }
  | {
      ok: false;
      orderToken: string;
      errorCode: string;
      errorMessage: string;
      retryable: boolean;
    };

function getError(error: unknown) {
  if (error instanceof MerchizeApiError) {
    return {
      code: error.code,
      message: error.message,
      responseSummary: error.responseSummary,
    };
  }

  return {
    code: 'MERCHIZE_READINESS_CHECK_FAILED',
    message: safeLogErrorMessage(error),
    responseSummary: null,
  };
}

export async function runMerchizeProductionReadinessChecks(
  orderToken: string,
  options: ReadinessOptions = {},
): Promise<MerchizeProductionReadinessCheckResult> {
  if (!isMerchizeFulfillmentOpsDatabaseConfigured()) {
    return {
      ok: false,
      orderToken,
      errorCode: 'MERCHIZE_FULFILLMENT_OPS_DB_NOT_CONFIGURED',
      errorMessage: 'Merchize Fulfillment Ops database is not configured.',
      retryable: false,
    };
  }

  const prisma = getMerchizeFulfillmentOpsPrisma();
  const order = await prisma.merchizeFulfillmentOrder.findFirst({
    where: { orderToken },
    orderBy: { updatedAt: 'desc' },
  });

  if (!order?.merchizeOrderId) {
    return {
      ok: false,
      orderToken,
      errorCode: 'MERCHIZE_ORDER_ID_MISSING',
      errorMessage: 'Merchize platform order ID is missing before production-readiness checks.',
      retryable: true,
    };
  }
  const providerReleaseAlreadyVerified =
    order.productionGateStatus === MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_VERIFIED ||
    Boolean(order.pushVerifiedAt);

  const attempt = await prisma.merchizeFulfillmentSyncAttempt.create({
    data: {
      merchizeFulfillmentOrderId: order.id,
      orderToken,
      action: 'production_readiness',
      status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.RUNNING,
      requestSummary: summarizeProviderRequest({
        merchizeOrderId: order.merchizeOrderId,
        allowStaleOrderManualRelease: options.allowStaleOrderManualRelease === true,
      }),
    },
  });

  await prisma.merchizeFulfillmentOrder.update({
    where: { id: order.id },
    data: {
      syncStatus: MERCHIZE_FULFILLMENT_SYNC_STATUS.READINESS_CHECKING,
      productionGateStatus: providerReleaseAlreadyVerified
        ? MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_VERIFIED
        : MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.CHECKING,
      lastSyncErrorCode: null,
      lastSyncErrorMessage: null,
    },
  });

  try {
    const [
      detail,
      addressSuggestion,
      unfulfilledItems,
      fulfillmentCost,
      requireAttention,
      sendToFulfillment,
    ] = await Promise.all([
      getMerchizeInDepthOrderDetail(order.merchizeOrderId),
      getMerchizeAddressSuggestion(order.merchizeOrderId),
      getMerchizeUnfulfilledItems(order.merchizeOrderId),
      getMerchizeFulfillmentCostInvoice(order.merchizeOrderId),
      getMerchizeRequireAttention(order.merchizeOrderId),
      getMerchizeSendToFulfillmentDate(order.merchizeOrderId),
    ]);
    const readiness = classifyMerchizeProductionReadiness({
      detail,
      addressSuggestion,
      unfulfilledItems,
      fulfillmentCost,
      requireAttention,
      sendToFulfillment,
      allowStaleOrderManualRelease: options.allowStaleOrderManualRelease,
    });
    const checkedAt = new Date();
    const productionGateStatus =
      readiness.status === 'already_pushed'
        ? MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_VERIFIED
        : readiness.status === 'ready'
          ? MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.READY
          : readiness.status === 'manual_release_required'
            ? MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.MANUAL_RELEASE_REQUIRED
            : MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.BLOCKED;
    const syncStatus = readiness.ready
      ? readiness.status === 'already_pushed'
        ? MERCHIZE_FULFILLMENT_SYNC_STATUS.PUSH_VERIFIED
        : MERCHIZE_FULFILLMENT_SYNC_STATUS.READINESS_READY
      : MERCHIZE_FULFILLMENT_SYNC_STATUS.READINESS_BLOCKED;
    const readinessSummary = {
      status: readiness.status,
      blockers: readiness.blockers,
      addressReviewStatus: readiness.addressReviewStatus,
      itemReviewStatus: readiness.itemReviewStatus,
      artworkReviewStatus: readiness.artworkReviewStatus,
      costReviewStatus: readiness.costReviewStatus,
      attentionReviewStatus: readiness.attentionReviewStatus,
      providerPushProgress: readiness.providerPushProgress,
      providerPushState: readiness.providerPushState,
      manualReleaseRequired: readiness.manualReleaseRequired,
      checkedAt: checkedAt.toISOString(),
    };

    await prisma.$transaction(async (tx) => {
      await tx.merchizeFulfillmentOrder.update({
        where: { id: order.id },
        data: {
          syncStatus,
          productionGateStatus,
          addressReviewStatus: readiness.addressReviewStatus,
          itemReviewStatus: readiness.itemReviewStatus,
          artworkReviewStatus: readiness.artworkReviewStatus,
          costReviewStatus: readiness.costReviewStatus,
          attentionReviewStatus: readiness.attentionReviewStatus,
          providerPushProgress: readiness.providerPushProgress,
          manualReleaseRequired: readiness.manualReleaseRequired,
          providerPaidAt: readiness.providerPaidAt,
          lastReadinessCheckAt: checkedAt,
          lastAddressCheckAt: checkedAt,
          lastCostCheckAt: checkedAt,
          merchizeInDepthOrderDetailPayload: toOptionalPrismaJson(detail),
          merchizeAddressSuggestionPayload: toOptionalPrismaJson(addressSuggestion),
          merchizeUnfulfilledItemsPayload: toOptionalPrismaJson(unfulfilledItems),
          merchizeRequireAttentionPayload: toOptionalPrismaJson(requireAttention),
          merchizeSendToFulfillmentPayload: toOptionalPrismaJson(sendToFulfillment),
          merchizeFulfillmentCostPayload: toOptionalPrismaJson(fulfillmentCost),
          merchizeProductionReadinessPayload: toPrismaJson(readinessSummary),
          ...(readiness.status === 'already_pushed'
            ? {
                releasedToProductionAt: order.releasedToProductionAt ?? checkedAt,
                pushVerifiedAt: order.pushVerifiedAt ?? checkedAt,
              }
            : {}),
          lastSyncErrorCode: readiness.primaryBlocker?.code ?? null,
          lastSyncErrorMessage: readiness.primaryBlocker?.message ?? null,
        },
      });

      await tx.merchizeFulfillmentSyncAttempt.update({
        where: { id: attempt.id },
        data: {
          status: readiness.ready
            ? MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.SUCCEEDED
            : MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.SKIPPED,
          errorCode: readiness.primaryBlocker?.code ?? null,
          errorMessage: readiness.primaryBlocker?.message ?? null,
          responseSummary: summarizeProviderResponse({
            success: readiness.ready,
            status: readiness.status,
            message: readiness.primaryBlocker?.message ?? 'Production readiness passed.',
            data: readinessSummary,
          }),
          finishedAt: checkedAt,
        },
      });
    });

    await refreshPaidOrderRecoveryProjectionSafely(orderToken);
    return {
      ok: true,
      orderToken,
      merchizeOrderId: order.merchizeOrderId,
      pushAcknowledgedAt: order.pushAcknowledgedAt,
      pushVerifiedAt: order.pushVerifiedAt,
      readiness,
    };
  } catch (error) {
    const readinessError = getError(error);
    const failedAt = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.merchizeFulfillmentOrder.update({
        where: { id: order.id },
        data: {
          syncStatus: providerReleaseAlreadyVerified
            ? MERCHIZE_FULFILLMENT_SYNC_STATUS.PUSH_VERIFIED
            : MERCHIZE_FULFILLMENT_SYNC_STATUS.READINESS_BLOCKED,
          productionGateStatus: providerReleaseAlreadyVerified
            ? MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_VERIFIED
            : MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.BLOCKED,
          lastReadinessCheckAt: failedAt,
          lastSyncErrorCode: readinessError.code,
          lastSyncErrorMessage: readinessError.message,
        },
      });
      await tx.merchizeFulfillmentSyncAttempt.update({
        where: { id: attempt.id },
        data: {
          status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.FAILED,
          errorCode: readinessError.code,
          errorMessage: readinessError.message,
          responseSummary: summarizeProviderResponse(readinessError.responseSummary),
          finishedAt: failedAt,
        },
      });
    });

    await refreshPaidOrderRecoveryProjectionSafely(orderToken);
    return {
      ok: false,
      orderToken,
      errorCode: readinessError.code,
      errorMessage: readinessError.message,
      retryable: true,
    };
  }
}

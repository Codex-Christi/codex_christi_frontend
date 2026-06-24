import 'server-only';

import {
  getMerchizeFulfillmentOpsPrisma,
  isMerchizeFulfillmentOpsDatabaseConfigured,
} from '@/lib/prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOpsPrisma';
import {
  getMerchizeInDepthOrderDetail,
  getMerchizeOrderByExternalNumber,
  MerchizeApiError,
} from './merchizeClient';
import {
  extractMerchizeOrderIdFromExternalLookup,
  extractNormalizedFulfillmentItems,
  extractNormalizedOrderSnapshot,
  summarizeProviderRequest,
  summarizeProviderResponse,
  toOptionalPrismaJson,
} from './merchizeMapper';
import {
  isMerchizeProviderProcessingLookupPayload,
  MERCHIZE_LOOKUP_PENDING_PROVIDER_PROCESSING_ERROR_CODE,
  MERCHIZE_LOOKUP_PENDING_PROVIDER_PROCESSING_MESSAGE,
} from './lookupPending';
import { safeLogErrorMessage } from './redaction';
import {
  MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS,
  MERCHIZE_FULFILLMENT_SYNC_STATUS,
} from './status';
import { refreshPaidOrderRecoveryProjectionSafely } from '@/lib/paypal/txLedger/paidOrderRecoveryProjection';
import type { MerchizeFulfillmentSyncResult } from './merchizeTypes';

type SyncAction = 'external_lookup' | 'detail_lookup';
type SyncMerchizeFulfillmentOrderOptions = {
  lookupRetryDelaysMs?: readonly number[];
};

const DEFAULT_LOOKUP_RETRY_DELAYS_MS = [1_500, 3_000] as const;
const LOOKUP_PROVIDER_PROCESSING_ESCALATION_ATTEMPTS = 4;
const LOOKUP_PROVIDER_PROCESSING_ESCALATION_GRACE_MS = 10 * 60_000;

async function startSyncAttempt(args: {
  merchizeFulfillmentOrderId: string;
  orderToken: string;
  action: SyncAction;
  requestSummary?: unknown;
}) {
  const prisma = getMerchizeFulfillmentOpsPrisma();

  return prisma.merchizeFulfillmentSyncAttempt.create({
    data: {
      merchizeFulfillmentOrderId: args.merchizeFulfillmentOrderId,
      orderToken: args.orderToken,
      action: args.action,
      status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.RUNNING,
      requestSummary: args.requestSummary
        ? summarizeProviderRequest(args.requestSummary)
        : undefined,
    },
  });
}

async function finishSyncAttempt(args: {
  attemptId: string;
  status: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  responseSummary?: unknown;
}) {
  const prisma = getMerchizeFulfillmentOpsPrisma();

  await prisma.merchizeFulfillmentSyncAttempt.update({
    where: { id: args.attemptId },
    data: {
      status: args.status,
      errorCode: args.errorCode ?? null,
      errorMessage: args.errorMessage ?? null,
      responseSummary:
        args.responseSummary === undefined
          ? undefined
          : summarizeProviderResponse(args.responseSummary),
      finishedAt: new Date(),
    },
  });
}

function getSyncError(error: unknown) {
  if (error instanceof MerchizeApiError) {
    return {
      code: error.code,
      message: error.message,
      responseSummary: error.responseSummary,
    };
  }

  return {
    code: 'MERCHIZE_SYNC_FAILED',
    message: safeLogErrorMessage(error),
    responseSummary: null,
  };
}

function wait(ms: number) {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function lookupExternalOrderWithProviderProcessingBackoff(args: {
  merchizeExternalOrderNumber: string;
  merchizeIdentifier: string | null;
  retryDelaysMs: readonly number[];
}) {
  let lookup = await getMerchizeOrderByExternalNumber(
    args.merchizeExternalOrderNumber,
    args.merchizeIdentifier,
  );
  let retryCount = 0;

  for (const delayMs of args.retryDelaysMs) {
    if (!isMerchizeProviderProcessingLookupPayload(lookup)) break;

    retryCount += 1;
    await wait(delayMs);
    lookup = await getMerchizeOrderByExternalNumber(
      args.merchizeExternalOrderNumber,
      args.merchizeIdentifier,
    );
  }

  return {
    lookup,
    retryCount,
    providerProcessingPending: isMerchizeProviderProcessingLookupPayload(lookup),
  };
}

async function getProviderProcessingEscalationState(args: {
  merchizeFulfillmentOrderId: string;
  now: Date;
}) {
  const prisma = getMerchizeFulfillmentOpsPrisma();
  const where = {
    merchizeFulfillmentOrderId: args.merchizeFulfillmentOrderId,
    action: 'external_lookup',
    errorCode: MERCHIZE_LOOKUP_PENDING_PROVIDER_PROCESSING_ERROR_CODE,
  } as const;
  const [priorAttemptCount, oldestPendingAttempt] = await Promise.all([
    prisma.merchizeFulfillmentSyncAttempt.count({ where }),
    prisma.merchizeFulfillmentSyncAttempt.findFirst({
      where,
      orderBy: { startedAt: 'asc' },
      select: { startedAt: true },
    }),
  ]);
  const totalPendingAttemptCount = priorAttemptCount + 1;
  const firstPendingAt = oldestPendingAttempt?.startedAt ?? args.now;
  const pendingAgeMs = args.now.getTime() - firstPendingAt.getTime();

  return {
    totalPendingAttemptCount,
    pendingAgeMs,
    shouldEscalate:
      totalPendingAttemptCount >= LOOKUP_PROVIDER_PROCESSING_ESCALATION_ATTEMPTS ||
      pendingAgeMs >= LOOKUP_PROVIDER_PROCESSING_ESCALATION_GRACE_MS,
  };
}

async function refreshProjectionAndReturn<T extends MerchizeFulfillmentSyncResult>(result: T) {
  await refreshPaidOrderRecoveryProjectionSafely(result.orderToken);
  return result;
}

export async function syncMerchizeFulfillmentOrder(
  orderToken: string,
  options: SyncMerchizeFulfillmentOrderOptions = {},
): Promise<MerchizeFulfillmentSyncResult> {
  if (!isMerchizeFulfillmentOpsDatabaseConfigured()) {
    return {
      ok: false,
      orderToken,
      errorCode: 'MERCHIZE_FULFILLMENT_OPS_DB_NOT_CONFIGURED',
      errorMessage: 'Merchize Fulfillment Ops database is not configured.',
    };
  }

  const prisma = getMerchizeFulfillmentOpsPrisma();
  const order = await prisma.merchizeFulfillmentOrder.findFirst({
    where: { orderToken },
    orderBy: { updatedAt: 'desc' },
  });

  if (!order) {
    return {
      ok: false,
      orderToken,
      errorCode: 'MERCHIZE_FULFILLMENT_OPS_ORDER_NOT_FOUND',
      errorMessage: 'Merchize Fulfillment Ops order was not found.',
    };
  }

  let activeAttemptId: string | null = null;
  let activeAction: SyncAction = 'external_lookup';
  let merchizeOrderId = order.merchizeOrderId;

  try {
    await prisma.merchizeFulfillmentOrder.update({
      where: { id: order.id },
      data: {
        syncStatus: MERCHIZE_FULFILLMENT_SYNC_STATUS.LOOKUP_PENDING,
        lastSyncErrorCode: null,
        lastSyncErrorMessage: null,
      },
    });

    const lookupAttempt = await startSyncAttempt({
      merchizeFulfillmentOrderId: order.id,
      orderToken: order.orderToken,
      action: 'external_lookup',
      requestSummary: {
        merchizeExternalOrderNumber: order.merchizeExternalOrderNumber,
        fulfillmentIdentifier: order.merchizeIdentifier,
        providerProcessingRetryDelaysMs:
          options.lookupRetryDelaysMs ?? DEFAULT_LOOKUP_RETRY_DELAYS_MS,
      },
    });
    activeAttemptId = lookupAttempt.id;

    const { lookup, retryCount, providerProcessingPending } =
      await lookupExternalOrderWithProviderProcessingBackoff({
        merchizeExternalOrderNumber: order.merchizeExternalOrderNumber,
        merchizeIdentifier: order.merchizeIdentifier,
        retryDelaysMs: options.lookupRetryDelaysMs ?? DEFAULT_LOOKUP_RETRY_DELAYS_MS,
      });
    merchizeOrderId = extractMerchizeOrderIdFromExternalLookup(lookup);

    if (!merchizeOrderId) {
      if (providerProcessingPending) {
        const providerProcessingEscalation = await getProviderProcessingEscalationState({
          merchizeFulfillmentOrderId: order.id,
          now: new Date(),
        });

        if (providerProcessingEscalation.shouldEscalate) {
          const message =
            'Merchize external-number lookup kept reporting provider processing and did not return data._id within the retry grace window.';

          await prisma.merchizeFulfillmentOrder.update({
            where: { id: order.id },
            data: {
              merchizeExternalLookupPayload: toOptionalPrismaJson(lookup),
              syncStatus: MERCHIZE_FULFILLMENT_SYNC_STATUS.LOOKUP_NOT_FOUND,
              lastSyncErrorCode: 'MERCHIZE_LOOKUP_NOT_FOUND',
              lastSyncErrorMessage: message,
              lastLookupAt: new Date(),
            },
          });

          await finishSyncAttempt({
            attemptId: activeAttemptId,
            status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.FAILED,
            errorCode: 'MERCHIZE_LOOKUP_NOT_FOUND',
            errorMessage: message,
            responseSummary: lookup,
          });

          return refreshProjectionAndReturn({
            ok: false,
            orderToken,
            errorCode: 'MERCHIZE_LOOKUP_NOT_FOUND',
            errorMessage: message,
          });
        }

        await prisma.merchizeFulfillmentOrder.update({
          where: { id: order.id },
          data: {
            merchizeExternalLookupPayload: toOptionalPrismaJson(lookup),
            syncStatus: MERCHIZE_FULFILLMENT_SYNC_STATUS.LOOKUP_PENDING,
            lastSyncErrorCode: MERCHIZE_LOOKUP_PENDING_PROVIDER_PROCESSING_ERROR_CODE,
            lastSyncErrorMessage: MERCHIZE_LOOKUP_PENDING_PROVIDER_PROCESSING_MESSAGE,
            lastLookupAt: new Date(),
          },
        });

        await finishSyncAttempt({
          attemptId: activeAttemptId,
          status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.SKIPPED,
          errorCode: MERCHIZE_LOOKUP_PENDING_PROVIDER_PROCESSING_ERROR_CODE,
          errorMessage: MERCHIZE_LOOKUP_PENDING_PROVIDER_PROCESSING_MESSAGE,
          responseSummary: lookup,
        });

        return refreshProjectionAndReturn({
          ok: false,
          orderToken,
          errorCode: MERCHIZE_LOOKUP_PENDING_PROVIDER_PROCESSING_ERROR_CODE,
          errorMessage: MERCHIZE_LOOKUP_PENDING_PROVIDER_PROCESSING_MESSAGE,
          pending: true,
          retryable: true,
        });
      }

      const message =
        'Merchize external-number lookup did not return data._id for the expected external number.';

      await prisma.merchizeFulfillmentOrder.update({
        where: { id: order.id },
        data: {
          merchizeExternalLookupPayload: toOptionalPrismaJson(lookup),
          syncStatus: MERCHIZE_FULFILLMENT_SYNC_STATUS.LOOKUP_NOT_FOUND,
          lastSyncErrorCode: 'MERCHIZE_LOOKUP_NOT_FOUND',
          lastSyncErrorMessage: message,
          lastLookupAt: new Date(),
        },
      });

      await finishSyncAttempt({
        attemptId: activeAttemptId,
        status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.FAILED,
        errorCode: 'MERCHIZE_LOOKUP_NOT_FOUND',
        errorMessage: message,
        responseSummary: lookup,
      });

      return refreshProjectionAndReturn({
        ok: false,
        orderToken,
        errorCode: 'MERCHIZE_LOOKUP_NOT_FOUND',
        errorMessage: message,
      });
    }

    await prisma.merchizeFulfillmentOrder.update({
      where: { id: order.id },
      data: {
        merchizeOrderId,
        merchizeExternalLookupPayload: toOptionalPrismaJson(lookup),
        syncStatus: MERCHIZE_FULFILLMENT_SYNC_STATUS.LOOKUP_FOUND,
        lastLookupAt: new Date(),
      },
    });

    await finishSyncAttempt({
      attemptId: activeAttemptId,
      status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.SUCCEEDED,
      responseSummary: lookup,
    });

    if (retryCount > 0) {
      console.info('[merchize.fulfillment_ops.lookup_recovered_after_provider_processing]', {
        orderToken: order.orderToken,
        retryCount,
      });
    }

    activeAction = 'detail_lookup';
    const detailAttempt = await startSyncAttempt({
      merchizeFulfillmentOrderId: order.id,
      orderToken: order.orderToken,
      action: 'detail_lookup',
      requestSummary: { merchizeOrderId },
    });
    activeAttemptId = detailAttempt.id;

    await prisma.merchizeFulfillmentOrder.update({
      where: { id: order.id },
      data: { syncStatus: MERCHIZE_FULFILLMENT_SYNC_STATUS.DETAIL_PENDING },
    });

    const detail = await getMerchizeInDepthOrderDetail(merchizeOrderId);
    const items = extractNormalizedFulfillmentItems({
      lookupPayload: lookup,
      detailPayload: detail,
    });
    const snapshot = extractNormalizedOrderSnapshot({
      lookupPayload: lookup,
      detailPayload: detail,
      items,
    });

    await prisma.$transaction(async (tx) => {
      await tx.merchizeFulfillmentOrder.update({
        where: { id: order.id },
        data: {
          merchizeOrderId,
          merchizeOrderCode: snapshot.merchizeOrderCode ?? order.merchizeOrderCode,
          merchizeIdentifier: snapshot.merchizeIdentifier,
          merchizeStatus: snapshot.merchizeStatus,
          merchizeSubStatus: snapshot.merchizeSubStatus,
          merchizeIsEnqueued: snapshot.merchizeIsEnqueued,
          merchizeIsDeleted: snapshot.merchizeIsDeleted,
          merchizeHidden: snapshot.merchizeHidden,
          itemCount: snapshot.itemCount,
          totalQuantity: snapshot.totalQuantity,
          orderCurrency: snapshot.orderCurrency,
          merchizeExternalLookupPayload: toOptionalPrismaJson(lookup),
          merchizeInDepthOrderDetailPayload: toOptionalPrismaJson(detail),
          syncStatus: MERCHIZE_FULFILLMENT_SYNC_STATUS.DETAIL_SYNCED,
          lastSyncErrorCode: null,
          lastSyncErrorMessage: null,
          lastDetailSyncAt: new Date(),
        },
      });

      await tx.merchizeFulfillmentItem.deleteMany({
        where: { merchizeFulfillmentOrderId: order.id },
      });

      if (items.length) {
        await tx.merchizeFulfillmentItem.createMany({
          data: items.map((item) => ({
            merchizeFulfillmentOrderId: order.id,
            merchizeLineItemId: item.merchizeLineItemId,
            productId: item.productId,
            merchizeSku: item.merchizeSku,
            sellerSku: item.sellerSku,
            title: item.title,
            quantity: item.quantity,
            currency: item.currency,
            unitPrice: item.unitPrice,
            imageUrl: item.imageUrl,
            variantSummary: item.variantSummary,
            itemPayload: item.itemPayload,
          })),
        });
      }
    });

    await finishSyncAttempt({
      attemptId: activeAttemptId,
      status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.SUCCEEDED,
      responseSummary: detail,
    });

    return refreshProjectionAndReturn({
      ok: true,
      orderToken,
      merchizeExternalOrderNumber: order.merchizeExternalOrderNumber,
      merchizeOrderId,
      itemCount: items.length,
    });
  } catch (error) {
    const syncError = getSyncError(error);
    const syncStatus =
      activeAction === 'external_lookup'
        ? MERCHIZE_FULFILLMENT_SYNC_STATUS.LOOKUP_FAILED
        : MERCHIZE_FULFILLMENT_SYNC_STATUS.DETAIL_FAILED;

    await prisma.merchizeFulfillmentOrder.update({
      where: { id: order.id },
      data: {
        syncStatus,
        lastSyncErrorCode: syncError.code,
        lastSyncErrorMessage: syncError.message,
        ...(activeAction === 'external_lookup'
          ? { lastLookupAt: new Date() }
          : { lastDetailSyncAt: new Date() }),
      },
    });

    if (activeAttemptId) {
      await finishSyncAttempt({
        attemptId: activeAttemptId,
        status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.FAILED,
        errorCode: syncError.code,
        errorMessage: syncError.message,
        responseSummary: syncError.responseSummary,
      });
    }

    console.error('[merchize.fulfillment_ops.sync_failed]', {
      orderToken: order.orderToken,
      merchizeExternalOrderNumber: order.merchizeExternalOrderNumber,
      merchizeOrderId,
      action: activeAction,
      errorCode: syncError.code,
      error: syncError.message,
    });

    return refreshProjectionAndReturn({
      ok: false,
      orderToken,
      errorCode: syncError.code,
      errorMessage: syncError.message,
    });
  }
}

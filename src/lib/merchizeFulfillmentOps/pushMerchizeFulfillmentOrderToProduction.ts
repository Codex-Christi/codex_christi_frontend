import 'server-only';

import {
  getMerchizeFulfillmentOpsPrisma,
  isMerchizeFulfillmentOpsDatabaseConfigured,
} from '@/lib/prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOpsPrisma';
import {
  getMerchizeOrderByExternalNumber,
  MerchizeApiError,
  pushMerchizeExternalOrderToFulfillment,
  type MerchizeExternalOrderReference,
} from './merchizeClient';
import { asRecord, summarizeProviderRequest, summarizeProviderResponse } from './merchizeMapper';
import {
  isMerchizeFulfillmentCanceled,
  MERCHIZE_FULFILLMENT_CANCELED_CODE,
  MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS,
  MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS,
  MERCHIZE_FULFILLMENT_SYNC_STATUS,
  MERCHIZE_ORDER_ON_HOLD,
  MERCHIZE_PUSH_ACTION,
  MERCHIZE_UNCONFIRMED_PUSH_ATTEMPT,
} from './status';
import { refreshPaidOrderRecoveryProjectionSafely } from '@/lib/paypal/txLedger/paidOrderRecoveryProjection';
import {
  canObserveOrderHold,
  holdLookupVersion,
  observedOrderHold,
  readExternalOrderState,
} from './merchizeOrderHold';

export class MerchizeFulfillmentPushError extends Error {
  code: string;
  requestSummary: unknown;
  responseSummary: unknown;

  constructor(
    message: string,
    args: {
      code?: string;
      requestSummary?: unknown;
      responseSummary?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'MerchizeFulfillmentPushError';
    this.code = args.code ?? 'MERCHIZE_PUSH_FAILED';
    this.requestSummary = args.requestSummary ?? null;
    this.responseSummary = args.responseSummary ?? null;
  }
}

type PushInput = {
  orderToken: string;
  merchizeExternalOrderNumber?: string | null;
  merchizeOrderCode?: string | null;
  identifier?: string | null;
};

export type MerchizePushRequestOutcome = 'acknowledged' | 'unconfirmed' | 'not_sent';

function buildReference(input: PushInput): MerchizeExternalOrderReference {
  if (input.merchizeExternalOrderNumber?.trim()) {
    return {
      externalNumber: input.merchizeExternalOrderNumber.trim(),
      identifier: input.identifier,
    };
  }

  if (input.merchizeOrderCode?.trim()) {
    return {
      code: input.merchizeOrderCode.trim(),
      identifier: input.identifier,
    };
  }

  throw new MerchizeFulfillmentPushError(
    'Missing Merchize external order number or order code before push-to-fulfillment.',
    { code: 'MERCHIZE_PUSH_REFERENCE_MISSING' },
  );
}

function buildRequestSummary(reference: MerchizeExternalOrderReference) {
  return {
    order: {
      code: 'code' in reference && reference.code ? reference.code : '',
      external_number:
        'externalNumber' in reference && reference.externalNumber ? reference.externalNumber : '',
      identifier: reference.identifier ?? '',
    },
  };
}

export function classifyMerchizePushReply(response: unknown) {
  const record = asRecord(response);
  if (record?.success === true && record.data !== false && !record.error)
    return 'acknowledged';
  if (record?.success === false || (record?.success !== true && record?.data === false))
    return 'rejected';
  return 'unconfirmed';
}

export async function recordMerchizeFulfillmentPushDisabledByConfig(input: PushInput) {
  const reference = buildReference(input);
  const requestSummary = buildRequestSummary(reference);
  const prisma = isMerchizeFulfillmentOpsDatabaseConfigured()
    ? getMerchizeFulfillmentOpsPrisma()
    : null;

  if (!prisma) {
    return { ok: false as const, reason: 'database_not_configured' };
  }

  const order = await prisma.merchizeFulfillmentOrder.findFirst({
    where: { orderToken: input.orderToken },
    orderBy: { updatedAt: 'desc' },
  });

  if (!order) {
    return { ok: false as const, reason: 'order_not_found' };
  }

  const now = new Date();
  const message =
    'Merchize push-to-fulfillment is disabled by MERCHIZE_FULFILLMENT_PUSH_ENABLED=false.';

  await prisma.$transaction(async (tx) => {
    await tx.merchizeFulfillmentOrder.update({
      where: { id: order.id },
      data: {
        syncStatus: MERCHIZE_FULFILLMENT_SYNC_STATUS.PUSH_DISABLED,
        productionGateStatus: MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_DISABLED,
        lastSyncErrorCode: 'MERCHIZE_PUSH_DISABLED_BY_CONFIG',
        lastSyncErrorMessage: message,
      },
    });

    await tx.merchizeFulfillmentSyncAttempt.create({
      data: {
        merchizeFulfillmentOrderId: order.id,
        orderToken: input.orderToken,
        action: MERCHIZE_PUSH_ACTION,
        status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.SKIPPED,
        requestSummary: summarizeProviderRequest(requestSummary),
        responseSummary: summarizeProviderResponse({
          skipped: true,
          reason: 'MERCHIZE_FULFILLMENT_PUSH_ENABLED=false',
        }),
        errorCode: 'MERCHIZE_PUSH_DISABLED_BY_CONFIG',
        errorMessage: message,
        startedAt: now,
        finishedAt: now,
      },
    });
  });
  await refreshPaidOrderRecoveryProjectionSafely(input.orderToken);

  return { ok: true as const };
}

export async function pushMerchizeFulfillmentOrderToProduction(
  input: PushInput,
): Promise<MerchizePushRequestOutcome> {
  const reference = buildReference(input);
  const requestSummary = buildRequestSummary(reference);
  const prisma = isMerchizeFulfillmentOpsDatabaseConfigured()
    ? getMerchizeFulfillmentOpsPrisma()
    : null;
  const orders = prisma
    ? await prisma.merchizeFulfillmentOrder.findMany({
        where: { orderToken: input.orderToken },
        take: 2,
      })
    : [];
  const order = orders[0];
  if (!prisma || orders.length !== 1 || !order?.merchizeOrderId || order.duplicateDetectedAt ||
      input.merchizeExternalOrderNumber !== order.merchizeExternalOrderNumber) {
    throw new MerchizeFulfillmentPushError('The Merchize order could not be verified before release.', {
      code: 'MERCHIZE_PUSH_REFERENCE_UNVERIFIED',
    });
  }
  if (isMerchizeFulfillmentCanceled(order.deliveryStatus)) {
    throw new MerchizeFulfillmentPushError('Fulfillment was canceled in Merchize.', {
      code: MERCHIZE_FULFILLMENT_CANCELED_CODE,
    });
  }
  if (order.pushVerifiedAt || order.pushAcknowledgedAt || order.heldAt) {
    throw new MerchizeFulfillmentPushError('The order is held or an earlier release needs verification.', {
      code: order.heldAt ? MERCHIZE_ORDER_ON_HOLD : 'MERCHIZE_PUSH_EVIDENCE_EXISTS',
    });
  }
  const now = new Date();
  // The operator may have paused the order in Merchize since readiness was checked.
  const detail = await getMerchizeOrderByExternalNumber(
    order.merchizeExternalOrderNumber,
    order.merchizeIdentifier ?? input.identifier,
  );
  const state = detail?.success === true ? readExternalOrderState(order, detail.data) : null;
  if (!state || !canObserveOrderHold(order, now)) {
    throw new MerchizeFulfillmentPushError('The current Merchize release state could not be verified.', {
      code: 'MERCHIZE_PUSH_STATE_UNVERIFIED',
    });
  }
  const saveObservedState = (db: Pick<typeof prisma, 'merchizeFulfillmentOrder'>) =>
    db.merchizeFulfillmentOrder.updateMany({
      where: {
        ...holdLookupVersion(order),
        duplicateDetectedAt: null,
        heldAt: null,
        pushAcknowledgedAt: null,
        pushVerifiedAt: null,
      },
      data: {
        ...observedOrderHold(order, state, now),
        ...(state === 'unfulfilled'
          ? {
              syncStatus: MERCHIZE_FULFILLMENT_SYNC_STATUS.PUSH_PENDING,
              productionGateStatus: MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_PENDING,
              lastSyncErrorCode: null,
              lastSyncErrorMessage: null,
            }
          : {}),
      },
    });
  if (state !== 'unfulfilled') {
    await saveObservedState(prisma);
    throw new MerchizeFulfillmentPushError('Merchize did not confirm this order was available for release.', {
      code: isMerchizeFulfillmentCanceled(state)
        ? MERCHIZE_FULFILLMENT_CANCELED_CODE
        : state === 'on_hold' ? MERCHIZE_ORDER_ON_HOLD : 'MERCHIZE_PUSH_STATE_UNVERIFIED',
    });
  }

  const attempt = await prisma.$transaction(async (tx) => {
    const write = await saveObservedState(tx);
    const earlier = await tx.merchizeFulfillmentSyncAttempt.findFirst({
      where: { orderToken: input.orderToken, ...MERCHIZE_UNCONFIRMED_PUSH_ATTEMPT },
      select: { id: true },
    });
    if (earlier) return null;
    if (write.count !== 1) {
      throw new MerchizeFulfillmentPushError('The order changed before the push could be requested.', {
        code: 'MERCHIZE_PUSH_STATE_UNVERIFIED',
      });
    }
    // Save the attempt under the order write lock before any request can leave this process.
    return tx.merchizeFulfillmentSyncAttempt.create({
      data: {
        merchizeFulfillmentOrderId: order.id,
        orderToken: input.orderToken,
        action: MERCHIZE_PUSH_ACTION,
        status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.RUNNING,
        requestSummary: summarizeProviderRequest(requestSummary),
        startedAt: now,
      },
    });
  });
  if (!attempt) return 'unconfirmed';

  let outcome: ReturnType<typeof classifyMerchizePushReply> = 'unconfirmed';
  let response: unknown = null;
  try {
    response = await pushMerchizeExternalOrderToFulfillment(reference);
    outcome = classifyMerchizePushReply(response);
  } catch (error) {
    // A transport or HTTP error does not prove the supplier did not receive the request.
    response = error instanceof MerchizeApiError ? error.responseSummary : null;
  }
  const acknowledged = outcome === 'acknowledged';
  const rejected = outcome === 'rejected';
  const rejectionCode = 'MERCHIZE_PUSH_REJECTED';
  const rejectionMessage = 'Merchize rejected the push request.';
  const errorCode = acknowledged ? null : rejected ? rejectionCode : 'MERCHIZE_PUSH_REPLY_UNCONFIRMED';
  const message = acknowledged ? null : rejected
    ? rejectionMessage
    : 'Merchize did not confirm receipt of the push request. Verify the order before retrying.';
  try {
    await prisma.$transaction(async (tx) => {
      await tx.merchizeFulfillmentOrder.updateMany({
        where: { id: order.id, pushVerifiedAt: null },
        data: {
          syncStatus: acknowledged
            ? MERCHIZE_FULFILLMENT_SYNC_STATUS.PUSH_ACKNOWLEDGED
            : rejected
              ? MERCHIZE_FULFILLMENT_SYNC_STATUS.PUSH_FAILED
              : MERCHIZE_FULFILLMENT_SYNC_STATUS.PUSH_VERIFICATION_PENDING,
          productionGateStatus: acknowledged
            ? MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_ACKNOWLEDGED
            : rejected
              ? MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_FAILED
              : MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_VERIFICATION_PENDING,
          pushAcknowledgedAt: acknowledged ? new Date() : undefined,
          lastSyncErrorCode: errorCode,
          lastSyncErrorMessage: message,
        },
      });
      await tx.merchizeFulfillmentSyncAttempt.update({
        where: { id: attempt.id },
        data: {
          status: acknowledged
            ? MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.SUCCEEDED
            : rejected
              ? MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.FAILED
              : MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.UNCONFIRMED,
          responseSummary: summarizeProviderResponse(response),
          errorCode,
          errorMessage: message,
          finishedAt: new Date(),
        },
      });
    });
  } catch {
    // The running attempt remains durable if the response could not be recorded.
    return 'unconfirmed';
  }
  await refreshPaidOrderRecoveryProjectionSafely(input.orderToken);
  if (rejected) {
    throw new MerchizeFulfillmentPushError(rejectionMessage, {
      code: rejectionCode,
      requestSummary,
      responseSummary: summarizeProviderResponse(response),
    });
  }
  return acknowledged ? 'acknowledged' : 'unconfirmed';
}

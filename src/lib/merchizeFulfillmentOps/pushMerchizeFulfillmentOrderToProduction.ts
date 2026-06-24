import 'server-only';

import {
  getMerchizeFulfillmentOpsPrisma,
  isMerchizeFulfillmentOpsDatabaseConfigured,
} from '@/lib/prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOpsPrisma';
import {
  MerchizeApiError,
  pushMerchizeExternalOrderToFulfillment,
  type MerchizeExternalOrderMutationResponse,
  type MerchizeExternalOrderReference,
} from './merchizeClient';
import { asRecord, summarizeProviderRequest, summarizeProviderResponse } from './merchizeMapper';
import { safeLogErrorMessage } from './redaction';
import {
  MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS,
  MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS,
  MERCHIZE_FULFILLMENT_SYNC_STATUS,
} from './status';
import { refreshPaidOrderRecoveryProjectionSafely } from '@/lib/paypal/txLedger/paidOrderRecoveryProjection';

const PUSH_ACTION = 'push_to_fulfillment';

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

type PushResult = {
  ok: true;
  orderToken: string;
  merchizeExternalOrderNumber: string | null;
  response: MerchizeExternalOrderMutationResponse;
};

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

function getProviderFailure(response: MerchizeExternalOrderMutationResponse) {
  const record = asRecord(response);
  if (!record) return null;

  if (record.success === false) {
    return typeof record.message === 'string' && record.message.trim()
      ? record.message.trim()
      : 'Merchize push-to-fulfillment was not accepted.';
  }

  if (record.data === false) {
    return typeof record.message === 'string' && record.message.trim()
      ? record.message.trim()
      : 'Merchize push-to-fulfillment returned data=false.';
  }

  const error = record.error;
  if (error) {
    return typeof error === 'string' ? error : 'Merchize push-to-fulfillment returned an error.';
  }

  return null;
}

function getPushError(error: unknown) {
  if (error instanceof MerchizeFulfillmentPushError) {
    return {
      code: error.code,
      message: error.message,
      responseSummary: error.responseSummary,
    };
  }

  if (error instanceof MerchizeApiError) {
    return {
      code: error.code,
      message: error.message,
      responseSummary: error.responseSummary,
    };
  }

  return {
    code: 'MERCHIZE_PUSH_FAILED',
    message: safeLogErrorMessage(error),
    responseSummary: null,
  };
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
        action: PUSH_ACTION,
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
): Promise<PushResult> {
  const reference = buildReference(input);
  const requestSummary = buildRequestSummary(reference);
  const prisma = isMerchizeFulfillmentOpsDatabaseConfigured()
    ? getMerchizeFulfillmentOpsPrisma()
    : null;
  const order = prisma
    ? await prisma.merchizeFulfillmentOrder.findFirst({
        where: { orderToken: input.orderToken },
        orderBy: { updatedAt: 'desc' },
      })
    : null;
  const now = new Date();

  let attemptId: string | null = null;

  if (prisma && order) {
    await prisma.merchizeFulfillmentOrder.update({
      where: { id: order.id },
      data: {
        syncStatus: MERCHIZE_FULFILLMENT_SYNC_STATUS.PUSH_PENDING,
        productionGateStatus: MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_PENDING,
        lastSyncErrorCode: null,
        lastSyncErrorMessage: null,
      },
    });

    const attempt = await prisma.merchizeFulfillmentSyncAttempt.create({
      data: {
        merchizeFulfillmentOrderId: order.id,
        orderToken: input.orderToken,
        action: PUSH_ACTION,
        status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.RUNNING,
        requestSummary: summarizeProviderRequest(requestSummary),
        startedAt: now,
      },
    });
    attemptId = attempt.id;
  }

  try {
    const response = await pushMerchizeExternalOrderToFulfillment(reference);
    const providerFailure = getProviderFailure(response);

    if (providerFailure) {
      throw new MerchizeFulfillmentPushError(providerFailure, {
        code: 'MERCHIZE_PUSH_REJECTED',
        requestSummary,
        responseSummary: response,
      });
    }

    if (prisma && order) {
      await prisma.$transaction(async (tx) => {
        await tx.merchizeFulfillmentOrder.update({
          where: { id: order.id },
          data: {
            syncStatus: MERCHIZE_FULFILLMENT_SYNC_STATUS.PUSH_ACCEPTED,
            productionGateStatus: MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_ACCEPTED,
            releasedToProductionAt: new Date(),
            lastSyncErrorCode: null,
            lastSyncErrorMessage: null,
          },
        });

        if (attemptId) {
          await tx.merchizeFulfillmentSyncAttempt.update({
            where: { id: attemptId },
            data: {
              status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.SUCCEEDED,
              responseSummary: summarizeProviderResponse(response),
              finishedAt: new Date(),
            },
          });
        }
      });
      await refreshPaidOrderRecoveryProjectionSafely(input.orderToken);
    }

    return {
      ok: true,
      orderToken: input.orderToken,
      merchizeExternalOrderNumber: input.merchizeExternalOrderNumber ?? null,
      response,
    };
  } catch (error) {
    const pushError = getPushError(error);

    if (prisma && order) {
      await prisma.$transaction(async (tx) => {
        await tx.merchizeFulfillmentOrder.update({
          where: { id: order.id },
          data: {
            syncStatus: MERCHIZE_FULFILLMENT_SYNC_STATUS.PUSH_FAILED,
            productionGateStatus: MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_FAILED,
            lastSyncErrorCode: pushError.code,
            lastSyncErrorMessage: pushError.message,
          },
        });

        if (attemptId) {
          await tx.merchizeFulfillmentSyncAttempt.update({
            where: { id: attemptId },
            data: {
              status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.FAILED,
              errorCode: pushError.code,
              errorMessage: pushError.message,
              responseSummary: summarizeProviderResponse(pushError.responseSummary),
              finishedAt: new Date(),
            },
          });
        }
      });
      await refreshPaidOrderRecoveryProjectionSafely(input.orderToken);
    }

    throw new MerchizeFulfillmentPushError(pushError.message, {
      code: pushError.code,
      requestSummary,
      responseSummary: pushError.responseSummary,
    });
  }
}

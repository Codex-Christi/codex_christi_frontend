import 'server-only';

import {
  getMerchizeFulfillmentOpsPrisma,
  isMerchizeFulfillmentOpsDatabaseConfigured,
} from '@/lib/prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOpsPrisma';
import {
  getMerchizeBuyerDetails,
  getMerchizeInDepthOrderDetail,
  markMerchizeAddressValid,
  MerchizeApiError,
} from './merchizeClient';
import {
  getMerchizeBuyerAddressMismatchFields,
  type MerchizeBuyerAddressExpectation,
} from './addressCorrectionVerification';
import { asRecord, summarizeProviderRequest } from './merchizeMapper';
import {
  canManuallyConfirmMerchizeAddressStatus,
  getMerchizeAddressValidationEvidence,
} from './productionReadiness';
import { safeLogErrorMessage } from './redaction';
import {
  MERCHIZE_ADDRESS_REVIEW_STATUS,
  MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS,
  MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS,
} from './status';

type MarkAddressValidResult =
  | {
      ok: true;
      changed: boolean;
      validationStatus: string;
    }
  | {
      ok: false;
      errorCode: string;
      errorMessage: string;
    };

class MerchizeAddressConfirmationMismatchError extends Error {
  readonly mismatchFields: string[];

  constructor(mismatchFields: string[]) {
    super(
      `Merchize currently stores different fulfillment address fields: ${mismatchFields.join(', ')}. Refresh or correct the provider address before marking it valid.`,
    );
    this.name = 'MerchizeAddressConfirmationMismatchError';
    this.mismatchFields = mismatchFields;
  }
}

function getProviderFailure(payload: unknown) {
  const record = asRecord(payload);
  if (record?.success === false || record?.data === false || record?.error) {
    return typeof record.message === 'string' && record.message.trim()
      ? record.message.trim()
      : 'Merchize rejected the address confirmation.';
  }
  return null;
}

function getProviderPushProgress(detail: unknown) {
  const root = asRecord(detail);
  const data = asRecord(root?.data) ?? root;
  return typeof data?.push_to_fulfillment_progress === 'string'
    ? data.push_to_fulfillment_progress.trim().toLowerCase()
    : null;
}

function providerReleaseHasStarted(detail: unknown) {
  const progress = getProviderPushProgress(detail);
  return Boolean(
    progress &&
    ['pushed', 'validating', 'scheduled', 'processing', 'in_production', 'fulfilled'].includes(
      progress,
    ),
  );
}

export async function markMerchizeFulfillmentAddressValid({
  orderToken,
  expectedAddress,
}: {
  orderToken: string;
  expectedAddress: MerchizeBuyerAddressExpectation;
}): Promise<MarkAddressValidResult> {
  if (!isMerchizeFulfillmentOpsDatabaseConfigured()) {
    return {
      ok: false,
      errorCode: 'MERCHIZE_FULFILLMENT_OPS_DB_NOT_CONFIGURED',
      errorMessage: 'Merchize Fulfillment Ops database is not configured.',
    };
  }

  const prisma = getMerchizeFulfillmentOpsPrisma();
  const order = await prisma.merchizeFulfillmentOrder.findFirst({
    where: { orderToken },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      merchizeOrderId: true,
      productionGateStatus: true,
      pushAcknowledgedAt: true,
      pushVerifiedAt: true,
    },
  });

  if (!order?.merchizeOrderId) {
    return {
      ok: false,
      errorCode: 'MERCHIZE_ORDER_ID_MISSING',
      errorMessage: 'The imported Merchize order does not have an actionable provider order ID.',
    };
  }

  const releaseStartedGateStatuses = new Set<string>([
    MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_PENDING,
    MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_ACKNOWLEDGED,
    MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_VERIFICATION_PENDING,
    MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_VERIFIED,
  ]);
  const releaseGateStarted = Boolean(
    order.productionGateStatus && releaseStartedGateStatuses.has(order.productionGateStatus),
  );
  if (order.pushAcknowledgedAt || order.pushVerifiedAt || releaseGateStarted) {
    return {
      ok: false,
      errorCode: 'MERCHIZE_ADDRESS_CONFIRMATION_AFTER_PUSH_BLOCKED',
      errorMessage:
        'Merchize release has already started or completed. Address confirmation is no longer safe.',
    };
  }

  const attempt = await prisma.merchizeFulfillmentSyncAttempt.create({
    data: {
      merchizeFulfillmentOrderId: order.id,
      orderToken,
      action: 'provider_address_mark_valid',
      status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.RUNNING,
      requestSummary: summarizeProviderRequest({
        merchizeOrderId: order.merchizeOrderId,
        operation: 'mark_current_address_valid',
      }),
    },
  });

  try {
    const [detail, buyerDetails] = await Promise.all([
      getMerchizeInDepthOrderDetail(order.merchizeOrderId),
      getMerchizeBuyerDetails(order.merchizeOrderId),
    ]);
    if (providerReleaseHasStarted(detail)) {
      throw new Error(
        'Merchize release has already started or completed. Address confirmation is no longer safe.',
      );
    }

    const buyerDetailsFailure = getProviderFailure(buyerDetails);
    if (buyerDetailsFailure) throw new Error(buyerDetailsFailure);

    const mismatchFields = getMerchizeBuyerAddressMismatchFields(buyerDetails, expectedAddress);
    if (mismatchFields.length > 0) {
      throw new MerchizeAddressConfirmationMismatchError(mismatchFields);
    }

    const evidence = getMerchizeAddressValidationEvidence(detail);
    const alreadyConfirmed =
      evidence.markedValid ||
      evidence.status === 'valid' ||
      evidence.status === 'ignore' ||
      evidence.status === 'ignored';

    if (alreadyConfirmed) {
      const finishedAt = new Date();
      await prisma.$transaction([
        prisma.merchizeFulfillmentOrder.update({
          where: { id: order.id },
          data: {
            addressReviewStatus: evidence.markedValid
              ? MERCHIZE_ADDRESS_REVIEW_STATUS.BUYER_CONFIRMED
              : MERCHIZE_ADDRESS_REVIEW_STATUS.READY,
            lastAddressCheckAt: finishedAt,
          },
        }),
        prisma.merchizeFulfillmentSyncAttempt.update({
          where: { id: attempt.id },
          data: {
            status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.SKIPPED,
            responseSummary: {
              success: true,
              alreadyConfirmed: true,
              validationStatus: evidence.status,
            },
            finishedAt,
          },
        }),
      ]);

      return {
        ok: true,
        changed: false,
        validationStatus: evidence.status,
      };
    }

    if (!canManuallyConfirmMerchizeAddressStatus(evidence.status)) {
      throw new Error(
        `Merchize address status "${evidence.status}" cannot be manually confirmed. Correct the address instead.`,
      );
    }

    const response = await markMerchizeAddressValid(order.merchizeOrderId, evidence.status);
    const providerFailure = getProviderFailure(response);
    if (providerFailure) throw new Error(providerFailure);

    const acknowledgedAt = new Date();
    await prisma.$transaction([
      prisma.merchizeFulfillmentOrder.update({
        where: { id: order.id },
        data: {
          addressReviewStatus: MERCHIZE_ADDRESS_REVIEW_STATUS.PROVIDER_UPDATE_PENDING_VALIDATION,
          lastAddressCheckAt: acknowledgedAt,
        },
      }),
      prisma.merchizeFulfillmentSyncAttempt.update({
        where: { id: attempt.id },
        data: {
          status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.SUCCEEDED,
          responseSummary: {
            success: true,
            acknowledged: true,
            validationStatus: evidence.status,
          },
          finishedAt: acknowledgedAt,
        },
      }),
    ]);

    return {
      ok: true,
      changed: true,
      validationStatus: evidence.status,
    };
  } catch (error) {
    const errorCode =
      error instanceof MerchizeApiError
        ? error.code
        : error instanceof MerchizeAddressConfirmationMismatchError
          ? 'MERCHIZE_ADDRESS_CONFIRMATION_MISMATCH'
          : 'MERCHIZE_ADDRESS_MARK_VALID_FAILED';
    const errorMessage =
      error instanceof MerchizeApiError ? error.message : safeLogErrorMessage(error);
    const failedAt = new Date();

    await prisma.$transaction([
      prisma.merchizeFulfillmentOrder.update({
        where: { id: order.id },
        data: {
          lastSyncErrorCode: errorCode,
          lastSyncErrorMessage: errorMessage,
          lastAddressCheckAt: failedAt,
        },
      }),
      prisma.merchizeFulfillmentSyncAttempt.update({
        where: { id: attempt.id },
        data: {
          status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.FAILED,
          errorCode,
          errorMessage,
          responseSummary:
            error instanceof MerchizeAddressConfirmationMismatchError
              ? { mismatchFields: error.mismatchFields }
              : undefined,
          finishedAt: failedAt,
        },
      }),
    ]);

    return { ok: false, errorCode, errorMessage };
  }
}

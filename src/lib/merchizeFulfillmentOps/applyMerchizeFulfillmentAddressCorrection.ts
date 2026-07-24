import 'server-only';

import { normalizeCountryToIso2 } from '@/lib/utils/shop/checkout/normalizeCountryToIso3';
import {
  getMerchizeBuyerDetails,
  getMerchizeInDepthOrderDetail,
  getMerchizeRequireAttention,
  getMerchizeSendToFulfillmentDate,
  MerchizeApiError,
  type MerchizeBuyerAddress,
  updateMerchizeBuyerDetails,
} from './merchizeClient';
import {
  getMerchizeFulfillmentOpsPrisma,
  isMerchizeFulfillmentOpsDatabaseConfigured,
} from '@/lib/prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOpsPrisma';
import { asRecord, summarizeProviderRequest, summarizeProviderResponse } from './merchizeMapper';
import { safeLogErrorMessage } from './redaction';
import {
  MERCHIZE_ADDRESS_REVIEW_STATUS,
  MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS,
} from './status';
import { getMerchizeBuyerAddressMismatchFields } from './addressCorrectionVerification';

type FulfillmentAddressCorrection = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getDataRecord(payload: unknown) {
  return asRecord(asRecord(payload)?.data) ?? asRecord(payload);
}

function getAddressAttentionId(payload: unknown) {
  const data = asRecord(payload)?.data;
  const attentions = Array.isArray(data) ? data : Array.isArray(payload) ? payload : [];
  const attention = attentions.find((candidate) => {
    const record = asRecord(candidate);
    const type = asString(record?.type)?.toLowerCase() ?? '';
    return type.includes('address') || type.includes('invalid');
  });
  return asString(asRecord(attention)?._id) ?? asString(asRecord(attention)?.id);
}

function getProviderFailure(payload: unknown) {
  const record = asRecord(payload);
  if (record?.success === false || record?.data === false || record?.error) {
    return asString(record.message) ?? 'Merchize rejected the buyer-address update.';
  }
  return null;
}

function isProviderReleaseVerified(detail: unknown, sendToFulfillment: unknown) {
  const detailData = getDataRecord(detail);
  const sendData = getDataRecord(sendToFulfillment);
  const progress = asString(detailData?.push_to_fulfillment_progress)?.toLowerCase();
  return progress === 'pushed' || sendData?.pushed === true || sendData?.is_pushed === true;
}

class MerchizeAddressCorrectionVerificationError extends Error {
  constructor(mismatchFields: string[]) {
    super(
      `Merchize did not confirm the updated buyer address fields: ${mismatchFields.join(', ')}.`,
    );
    this.name = 'MerchizeAddressCorrectionVerificationError';
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyMerchizeBuyerAddress(
  merchizeOrderId: string,
  expected: MerchizeBuyerAddress,
) {
  let mismatchFields: string[] = [];
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await wait(400);

    try {
      const response = await getMerchizeBuyerDetails(merchizeOrderId);
      const providerFailure = getProviderFailure(response);
      if (providerFailure) throw new Error(providerFailure);

      lastError = null;
      mismatchFields = getMerchizeBuyerAddressMismatchFields(response, expected);
      if (mismatchFields.length === 0) return;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  throw new MerchizeAddressCorrectionVerificationError(mismatchFields);
}

export async function applyMerchizeFulfillmentAddressCorrection(args: {
  orderToken: string;
  customerName: string;
  address: FulfillmentAddressCorrection;
}) {
  if (!isMerchizeFulfillmentOpsDatabaseConfigured()) {
    return { ok: false as const, error: 'Merchize Fulfillment Ops database is not configured.' };
  }

  const prisma = getMerchizeFulfillmentOpsPrisma();
  const order = await prisma.merchizeFulfillmentOrder.findFirst({
    where: { orderToken: args.orderToken },
    orderBy: { updatedAt: 'desc' },
  });

  if (!order?.merchizeOrderId) {
    return {
      ok: false as const,
      error:
        'The imported Merchize order does not have an actionable provider order ID. Resolve provider identity before applying an address correction.',
    };
  }

  const attempt = await prisma.merchizeFulfillmentSyncAttempt.create({
    data: {
      merchizeFulfillmentOrderId: order.id,
      orderToken: args.orderToken,
      action: 'provider_address_correction',
      status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.RUNNING,
      requestSummary: summarizeProviderRequest({
        merchizeOrderId: order.merchizeOrderId,
        address: args.address,
      }),
    },
  });

  try {
    const [buyerDetails, requireAttention, detail, sendToFulfillment] = await Promise.all([
      getMerchizeBuyerDetails(order.merchizeOrderId),
      getMerchizeRequireAttention(order.merchizeOrderId),
      getMerchizeInDepthOrderDetail(order.merchizeOrderId),
      getMerchizeSendToFulfillmentDate(order.merchizeOrderId),
    ]);
    if (isProviderReleaseVerified(detail, sendToFulfillment)) {
      throw new Error(
        'Merchize already reports this order as pushed. Automatic address correction is no longer safe; use provider intervention before shipment.',
      );
    }
    const buyerData = getDataRecord(buyerDetails);
    const existingAddress = asRecord(buyerData?.shipping_address) ?? buyerData ?? {};
    const countryCode =
      normalizeCountryToIso2(args.address.country) ??
      asString(existingAddress.country_code) ??
      args.address.country.toUpperCase();
    const payload: MerchizeBuyerAddress = {
      ...existingAddress,
      full_name: asString(existingAddress.full_name) ?? args.customerName,
      address: args.address.line1,
      address2: args.address.line2 ?? '',
      city: args.address.city,
      state: args.address.state,
      postal_code: args.address.postalCode,
      country_code: countryCode,
      country:
        asString(existingAddress.country_code) === countryCode
          ? (asString(existingAddress.country) ?? args.address.country)
          : args.address.country,
    };
    const attentionRequestId = getAddressAttentionId(requireAttention);
    if (attentionRequestId) payload.attention_request_id = attentionRequestId;
    delete payload._id;
    delete payload.__v;

    const response = await updateMerchizeBuyerDetails(order.merchizeOrderId, payload);
    const providerFailure = getProviderFailure(response);
    if (providerFailure) throw new Error(providerFailure);
    await verifyMerchizeBuyerAddress(order.merchizeOrderId, payload);

    const updatedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.merchizeFulfillmentOrder.update({
        where: { id: order.id },
        data: {
          shippingCity: args.address.city,
          shippingState: args.address.state,
          shippingCountry: countryCode,
          addressReviewStatus:
            MERCHIZE_ADDRESS_REVIEW_STATUS.PROVIDER_UPDATE_PENDING_VALIDATION,
          providerAddressUpdatedAt: updatedAt,
          lastAddressCheckAt: updatedAt,
          lastSyncErrorCode: null,
          lastSyncErrorMessage: null,
        },
      });
      await tx.merchizeFulfillmentSyncAttempt.update({
        where: { id: attempt.id },
        data: {
          status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.SUCCEEDED,
          responseSummary: {
            success: true,
            addressVerified: true,
            verifiedFieldCount: 6,
          },
          finishedAt: updatedAt,
        },
      });
    });

    return {
      ok: true as const,
      providerUpdated: true as const,
      message: 'Address correction was applied to the imported Merchize order.',
    };
  } catch (error) {
    const message =
      error instanceof MerchizeApiError ? error.message : safeLogErrorMessage(error);
    const errorCode =
      error instanceof MerchizeAddressCorrectionVerificationError
        ? 'MERCHIZE_ADDRESS_CORRECTION_NOT_VERIFIED'
        : 'MERCHIZE_ADDRESS_CORRECTION_FAILED';
    const failedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.merchizeFulfillmentOrder.update({
        where: { id: order.id },
        data: {
          addressReviewStatus: MERCHIZE_ADDRESS_REVIEW_STATUS.PROVIDER_UPDATE_FAILED,
          lastSyncErrorCode: errorCode,
          lastSyncErrorMessage: message,
        },
      });
      await tx.merchizeFulfillmentSyncAttempt.update({
        where: { id: attempt.id },
        data: {
          status: MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.FAILED,
          errorCode,
          errorMessage: message,
          responseSummary:
            error instanceof MerchizeApiError
              ? summarizeProviderResponse(error.responseSummary)
              : undefined,
          finishedAt: failedAt,
        },
      });
    });

    return { ok: false as const, error: message };
  }
}

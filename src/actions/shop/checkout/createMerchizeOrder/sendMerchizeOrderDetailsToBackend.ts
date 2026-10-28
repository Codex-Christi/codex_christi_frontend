'use server';

import { decryptForPostProcessingServerAction } from '@/lib/utils/shop/checkout/serverPostProcessingCrypto';
import { parseDjangoFulfillmentProcessResponse } from '@/lib/paypal/txLedger/fulfillmentProcessResponse';
import { postDjangoOrder } from '@/lib/paypal/txLedger/djangoOrderRequest';
import { djangoOrderFailure } from '@/lib/paypal/txLedger/djangoOrderContract';

interface OrderProcessingItem {
  product_id: string;
  sku: string;
  merchize_sku: string;
  quantity: number;
  price: number;
  currency: string;
  image: string;
}

interface MerchizeFulfillmentProcessPayload {
  identifier: string;
  items: OrderProcessingItem[];
  first_name: string;
  last_name: string;
  address: string;
  address_2: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  phone: string;
}

interface MerchizeFulfillmentProcessProps {
  djangoPaymentSaveCustomId: string;
  djangoOrderIntentUuid?: string | null;
  djangoOrderIntentOrderId?: string | null;
  payload: MerchizeFulfillmentProcessPayload;
}

export type OrderProcessingAPIResponse = ReturnType<typeof parseDjangoFulfillmentProcessResponse>;

const ACCEPTED_INFORMATIONAL_MESSAGES = new Set(['order created but details not available']);
const IDEMPOTENT_PROVIDER_MESSAGES = new Set(['order is duplicated']);

function normalizeProviderMessage(message: string | null | undefined) {
  return message?.trim().toLowerCase() ?? '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getNestedProviderErrorMessage(response: OrderProcessingAPIResponse) {
  const responseData = asRecord(response.data?.response_data);
  const providerData = asRecord(responseData?.data);
  const nestedError = providerData?.error;

  return typeof nestedError === 'string' ? nestedError : null;
}

function isAcceptedInformationalMessage(message: string | null | undefined) {
  return ACCEPTED_INFORMATIONAL_MESSAGES.has(normalizeProviderMessage(message));
}

function isIdempotentProviderMessage(message: string | null | undefined) {
  return IDEMPOTENT_PROVIDER_MESSAGES.has(normalizeProviderMessage(message));
}

function isDjangoFulfillmentBusinessSuccess(response: OrderProcessingAPIResponse) {
  const nestedProviderError = getNestedProviderErrorMessage(response);

  if (isIdempotentProviderMessage(nestedProviderError)) {
    return response.success === true;
  }

  if (response.success !== true) return false;
  if (['failed', 'cancelled'].includes(response.data.processing_status)) return false;

  return (
    !response.data?.error_message || isAcceptedInformationalMessage(response.data.error_message)
  );
}

function getDjangoFulfillmentFailureMessage(response: OrderProcessingAPIResponse) {
  return (
    getNestedProviderErrorMessage(response) ||
    response.data?.error_message ||
    response.message ||
    'Django fulfillment processing returned a business failure'
  );
}

export const sendMerchizeOrderDetailsToBackend = async (encProps: string) => {
  let dispatched = false;
  try {
    const { djangoPaymentSaveCustomId, djangoOrderIntentUuid, djangoOrderIntentOrderId, payload } =
      JSON.parse(
        decryptForPostProcessingServerAction(encProps, 'fulfillment'),
      ) as MerchizeFulfillmentProcessProps;

    if (!djangoPaymentSaveCustomId) {
      throw new Error('Missing Django payment save custom_id before fulfillment processing');
    }

    // Django names this route segment `{custom_id}`. Locally it is always the
    // payment-save custom ID returned by /orders/order-payment.
    dispatched = true;
    const response = parseDjangoFulfillmentProcessResponse(
      await postDjangoOrder(
        `/orders/process/${encodeURIComponent(djangoPaymentSaveCustomId)}`,
        payload,
      ),
      {
        customId: djangoPaymentSaveCustomId,
        intentUuid: djangoOrderIntentUuid,
        orderId: djangoOrderIntentOrderId,
      },
    );

    if (!isDjangoFulfillmentBusinessSuccess(response)) {
      return {
        ok: false as const,
        error: {
          code: 'DJANGO_FULFILLMENT_REJECTED',
          outcome: 'uncertain' as const,
          message: getDjangoFulfillmentFailureMessage(response),
          responsePayload: response,
        },
      };
    }

    return { ...response, ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: djangoOrderFailure(error, dispatched ? 'uncertain' : 'not_sent'),
    };
  }
};

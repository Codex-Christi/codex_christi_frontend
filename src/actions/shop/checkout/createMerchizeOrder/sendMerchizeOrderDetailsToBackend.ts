'use server';

import { FetcherError, FetcherOptions, universalFetcher } from '@/lib/utils/SWRfetcherAdvanced';
import { generateSignatureHeaders } from '@/lib/hooks/shopHooks/checkout/helpers/generateSignatureHeaders';
import { returnReducedBackendError } from '@/lib/hooks/shopHooks/checkout/helpers/returnReducedBackendError';
import { decryptForPostProcessingServerAction } from '@/lib/utils/shop/checkout/serverPostProcessingCrypto';
import { getServerDjangoApiBaseUrl } from '@/lib/django/getServerDjangoApiBaseUrl';

const baseURL = getServerDjangoApiBaseUrl();

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
}

interface MerchizeFulfillmentProcessProps {
  djangoPaymentSaveCustomId: string;
  payload: MerchizeFulfillmentProcessPayload;
}

interface OrderProcessingAPIResponse {
  status: number;
  success: boolean;
  message: string;
  data: {
    id: string;
    order_payment_custom_id: string;
    order_intent_id: string;
    order_intent_order_id: string;
    provider_order_id: string | null;
    provider_order_code: string | null;
    processing_status:
      | 'pending'
      | 'processing'
      | 'shipped'
      | 'delivered'
      | 'cancelled'
      | 'completed'
      | 'failed';
    request_data: Record<string, unknown>;
    response_data: Record<string, unknown> | null;
    error_message: string | null;
    retry_count: number;
    date_created: string;
    date_updated: string;
  };
}

export const sendMerchizeOrderDetailsToBackend = async (encProps: string) => {
  const { djangoPaymentSaveCustomId, payload } = JSON.parse(
    decryptForPostProcessingServerAction(encProps),
  ) as MerchizeFulfillmentProcessProps;

  if (!djangoPaymentSaveCustomId) {
    throw new Error('Missing Django payment save custom_id before fulfillment processing');
  }

  try {
    // Django names this route segment `{custom_id}`. Locally it is always the
    // payment-save custom ID returned by /orders/order-payment.
    const response = await universalFetcher<OrderProcessingAPIResponse, typeof payload>(
      `${baseURL}/orders/process/${djangoPaymentSaveCustomId}`,
      {
        arg: payload,
        fetcherOptions: {
          method: 'POST',
          headers: { ...(await generateSignatureHeaders()) },
        } satisfies FetcherOptions,
      },
    );

    return { ok: true as const, ...response };
  } catch (err: FetcherError | unknown) {
    if (err instanceof FetcherError) {
      return {
        ok: false as const,
        error: returnReducedBackendError(err),
      };
    }

    return { ok: false as const, error: { message: 'Unknown error' } };
  }
};

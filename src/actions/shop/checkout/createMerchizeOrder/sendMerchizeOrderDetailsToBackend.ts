'use server';

import { FetcherError, FetcherOptions, universalFetcher } from '@/lib/utils/SWRfetcherAdvanced';
import { generateSignatureHeaders } from '@/lib/hooks/shopHooks/checkout/helpers/generateSignatureHeaders';
import { cache } from 'react';
import { CartVariant } from '@/stores/shop_stores/cartStore';
import { CompletedTxInterface } from '../../paypal/processCompletedTx';

const baseURL = process.env.NEXT_PUBLIC_BASE_URL;

// Remember to convert qunatity to num before sending to API
type OrderVariants = Pick<CartVariant, 'variantId' | 'quantity'>[];

interface MerchizeBackendOrderProps {
  orderVariants: OrderVariants;
  orderRecipientInfo: CompletedTxInterface['delivery_address'] & CompletedTxInterface['customer'];
  ORD_string: string;
  country_iso2: string;
}

export interface OrderProcessingResponse {
  status: number;
  success: boolean;
  message: string;
  data: {
    id: string;
    order_payment_custom_id: string;
    order_intent_id: string;
    order_intent_order_id: string;
    provider_order_id: string;
    provider_order_code: string;
    processing_staus: [
      'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'completed' | 'failed',
    ];
    error_message: string | null;
  };
}

// Main Async func
export const sendMerchizeOrderDetailsToBackend = cache(
  async (merchizeBackendOrderProps: MerchizeBackendOrderProps) => {
    const { orderRecipientInfo, orderVariants, ORD_string, country_iso2 } =
      merchizeBackendOrderProps;
    const {
      name,
      email,
      shipping_address_line_1,
      shipping_address_line_2,
      shipping_city,
      shipping_country,
      shipping_state,
      zip_code,
    } = orderRecipientInfo;

    const addressObj = {
      full_name: name,
      email,
      city: shipping_city,
      address: shipping_address_line_1,
      address2: shipping_address_line_2,
      state: shipping_state,
      postal_code: zip_code,
      country: shipping_country,
      country_code: country_iso2,
    };

    const reqBody = { address: addressObj, variants: orderVariants };

    try {
      const data = await universalFetcher<OrderProcessingResponse, typeof reqBody>(
        `${baseURL}/orders/process/${ORD_string}`,
        {
          arg: reqBody, // <- becomes JSON body (POST by default in your fetcher)
          fetcherOptions: {
            // You can override anything here if needed:
            method: 'POST', // your fetcher auto-POSTs when arg is present—this is optional
            headers: { ...(await generateSignatureHeaders()) },
            // cache: 'no-store', // if you want to force no caching on server
          } satisfies FetcherOptions,
        },
      );
      return { ok: true as const, data };
    } catch (err: FetcherError | unknown) {
      if (err instanceof FetcherError) {
        console.log(err.info);
      }

      // Leverage your FetcherError for rich error info
      if (err instanceof FetcherError) {
        return {
          ok: false as const,
          error: { message: err.message, status: err.status, info: err.info },
        };
      }
      return { ok: false as const, error: { message: 'Unknown error' } };
    }
  },
);

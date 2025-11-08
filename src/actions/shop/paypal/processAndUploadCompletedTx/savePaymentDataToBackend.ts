'use server';

import { FetcherError, FetcherOptions, universalFetcher } from '@/lib/utils/SWRfetcherAdvanced';
import { generateSignatureHeaders } from '@/lib/hooks/shopHooks/checkout/helpers/generateSignatureHeaders';
import { cache } from 'react';
import { CompletedTxInterface } from '@/lib/hooks/shopHooks/checkout/usePost-PaymentProcessors';
import { OrderResponseBody } from '@paypal/paypal-js';
import { decrypt } from '@/stores/shop_stores/cartStore';
import { OrdersCapture } from '@paypal/paypal-server-sdk';
import { returnReducedBackendError } from '@/lib/hooks/shopHooks/checkout/helpers/returnReducedBackendError';

const baseURL = process.env.NEXT_PUBLIC_BASE_URL;

export interface PaymentJSONData extends Omit<OrderResponseBody, 'payer'> {
  message: string;
  timestamp: string;
  capturedOrderPaypalID: CompletedTxInterface['capturedOrder']['id'];
  custom_id: string;
  amountReceived: string | null;

  orderReceipient: {
    name: string | undefined;
    recepientEmail: string | null;
    orderID: string;
  };

  paypal_profile_delivery_address: CompletedTxInterface['delivery_address'] | null | undefined;
  userId: CompletedTxInterface['userId'] | null;
  paypalAuthorizationData: CompletedTxInterface['authData'];
}

interface ReqBody {
  paypal_payload: {
    paymentJSONData: PaymentJSONData;
    pdfReceiptLink: string;
    receiptFileName: string;
  };
}

export interface PaymentSaveResponse {
  status: number;
  success: boolean;
  message: string;
  data: {
    id: string;
    custom_id: string;
    receipient_email: string;
    user: string | null;
  };
}

export interface PaymentSavingActionProps extends Omit<CompletedTxInterface, 'cart'> {
  pdfReceiptLink: string;
  receiptFileName: string;
  finalCapturedOrder: OrdersCapture;
  capturedOrderPaypalID: string;
}

export const savePaymentDataToBackend = cache(async (encProps: string) => {
  // Main Destructuring (original comment)
  const {
    authData,
    capturedOrderPaypalID,
    customer,
    delivery_address,
    userId,
    ORD_string,
    pdfReceiptLink,
    receiptFileName,
    finalCapturedOrder,
  } = JSON.parse(decrypt(encProps)) as PaymentSavingActionProps;

  // Sub-destructuring (original comment)
  const { purchase_units, payer } = authData;
  const { email_address: payerEmail, name: payerName } = payer || {};

  // Safe array access with defaults (DeepSeek's improvement)
  const [firstPurchaseUnit = {}] = purchase_units || [];
  const { amount, custom_id, shipping } = firstPurchaseUnit;
  const { name: recepientName } = shipping || {};
  const recepientEmail = customer?.email;
  const { currency_code, value } = amount || {};

  const body = {
    paypal_payload: {
      paymentJSONData: {
        message: 'Data successfully processed!',
        timestamp: new Date().toISOString(),
        capturedOrderPaypalID,
        paymentAuthID: authData.id,
        custom_id: custom_id!,
        amountReceived: amount ? `${value} ${currency_code}` : null,
        payer: payer
          ? {
              payerEmail: payerEmail!,
              payerName: `${payerName?.given_name} ${payerName?.surname}`,
            }
          : null,
        orderReceipient: {
          name: recepientName?.full_name,
          recepientEmail: recepientEmail,
          orderID: ORD_string,
        },
        paypal_profile_delivery_address: delivery_address,
        userId: userId ?? null,
        paypalAuthorizationData: authData,
      },
      finalCapturedOrder,
      pdfReceiptLink,
      receiptFileName,
    },
  };

  // console.dir(body, { depth: null });

  try {
    const data = await universalFetcher<PaymentSaveResponse, ReqBody>(
      `${baseURL}/orders/order-payment`,
      {
        arg: body satisfies ReqBody, // <- becomes JSON body (POST by default in your fetcher)
        fetcherOptions: {
          // You can override anything here if needed:
          method: 'POST', // your fetcher auto-POSTs when arg is present—this is optional
          headers: { ...(await generateSignatureHeaders()) },
          // cache: 'no-store', // if you want to force no caching on server
        } satisfies FetcherOptions,
      },
    );

    // console.log(`Response on Server:`);
    // console.dir(data, { depth: null });
    // console.log('\n');

    return { ok: true as const, ...data };
  } catch (err: FetcherError | { message: string } | unknown) {
    // Leverage your FetcherError for rich error info
    if (err instanceof FetcherError) {
      return {
        ok: false as const,
        error: returnReducedBackendError(err),
      };
    }
    return {
      ok: false as const,
      error: {
        message:
          err && typeof err === 'object' && 'message' in err
            ? (err.message as string)
            : 'Unknown error',
      },
    };
  }
});

'use server';

import { FetcherError, FetcherOptions, universalFetcher } from '@/lib/utils/SWRfetcherAdvanced';
import { generateSignatureHeaders } from '@/lib/hooks/shopHooks/checkout/helpers/generateSignatureHeaders';
import { cache } from 'react';
import { CompletedTxInterface } from '@/lib/hooks/shopHooks/checkout/usePost-PaymentProcessors';
import { OrderResponseBody } from '@paypal/paypal-js';
import { OrdersCapture } from '@paypal/paypal-server-sdk';
import { returnReducedBackendError } from '@/lib/hooks/shopHooks/checkout/helpers/returnReducedBackendError';
import { decryptForPostProcessingServerAction } from '@/lib/utils/shop/checkout/serverPostProcessingCrypto';

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
  } = JSON.parse(decryptForPostProcessingServerAction(encProps)) as PaymentSavingActionProps;

  // Sub-destructuring (original comment)
  // The ledger stores PayPal server-SDK payloads, which use camelCase.
  // Keep snake_case fallbacks so older browser-shaped payloads still deserialize safely.
  const purchaseUnits =
    (authData as OrderResponseBody & {
      purchaseUnits?: PaymentJSONData['purchaseUnits'];
      purchase_units?: PaymentJSONData['purchaseUnits'];
    }).purchaseUnits ??
    (authData as OrderResponseBody & {
      purchase_units?: PaymentJSONData['purchaseUnits'];
    }).purchase_units ??
    [];

  const payer =
    (authData as OrderResponseBody & {
      payer?: OrderResponseBody['payer'];
    }).payer ?? null;

  const payerEmail =
    (payer as { emailAddress?: string; email_address?: string } | null)?.emailAddress ??
    (payer as { emailAddress?: string; email_address?: string } | null)?.email_address ??
    null;
  const payerName =
    (payer as { name?: { givenName?: string; surname?: string; given_name?: string } } | null)
      ?.name ?? null;

  // Safe array access with defaults (DeepSeek's improvement)
  const [firstPurchaseUnit = {}] = purchaseUnits;
  const amount =
    (firstPurchaseUnit as {
      amount?: { currencyCode?: string; currency_code?: string; value?: string };
    }).amount ?? null;
  const customId =
    (firstPurchaseUnit as { customId?: string; custom_id?: string }).customId ??
    (firstPurchaseUnit as { customId?: string; custom_id?: string }).custom_id ??
    null;
  const shipping =
    (firstPurchaseUnit as {
      shipping?: {
        name?: { fullName?: string; full_name?: string };
      };
    }).shipping ?? null;
  const recepientName = shipping?.name ?? null;
  const recepientEmail = customer?.email;
  const currencyCode = amount?.currencyCode ?? amount?.currency_code ?? null;
  const amountValue = amount?.value ?? null;

  if (!customId) {
    throw new Error('Missing PayPal customId/custom_id in authorize payload');
  }

  const body = {
    paypal_payload: {
      paymentJSONData: {
        message: 'Data successfully processed!',
        timestamp: new Date().toISOString(),
        capturedOrderPaypalID,
        paymentAuthID: authData.id,
        custom_id: customId,
        amountReceived: amount ? `${amountValue} ${currencyCode}` : null,
        payer: payer
          ? {
              payerEmail: payerEmail!,
              payerName: `${payerName?.givenName ?? payerName?.given_name ?? ''} ${payerName?.surname ?? ''}`.trim(),
            }
          : null,
        orderReceipient: {
          name: recepientName?.fullName ?? recepientName?.full_name,
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

'use server';

import { FetcherError, FetcherOptions, universalFetcher } from '@/lib/utils/SWRfetcherAdvanced';
import { generateSignatureHeaders } from '@/lib/hooks/shopHooks/checkout/helpers/generateSignatureHeaders';
import type { CompletedTxInterface } from '@/types/shop/paypalCompletedTx';
import { OrderResponseBody } from '@paypal/paypal-js';
import { OrdersCapture } from '@paypal/paypal-server-sdk';
import { returnReducedBackendError } from '@/lib/hooks/shopHooks/checkout/helpers/returnReducedBackendError';
import { decryptForPostProcessingServerAction } from '@/lib/utils/shop/checkout/serverPostProcessingCrypto';
import { getServerDjangoApiBaseUrl } from '@/lib/django/getServerDjangoApiBaseUrl';
import type { CanonicalOrderSnapshot } from '@/lib/paypal/orderSnapshot/types';
import { parseCanonicalOrderSnapshot } from '@/lib/paypal/orderSnapshot/canonicalize';
import { getCanonicalPaymentAmountReceived } from '@/lib/paypal/orderSnapshot/consumerData';
import {
  InvalidPaymentSaveResponseError,
  parsePaymentSaveResponse,
} from '@/lib/paypal/txLedger/paymentSaveResponse';

const baseURL = getServerDjangoApiBaseUrl();

export interface PaymentJSONData extends Omit<OrderResponseBody, 'payer'> {
  message: string;
  timestamp: string;
  capturedOrderPaypalID: CompletedTxInterface['capturedOrder']['id'];
  // Django's payment-save API expects this wire key. The value is PayPal purchase-unit
  // customId, which this checkout now sets to the local ledger orderToken.
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

export interface PaymentSavingActionProps extends Omit<CompletedTxInterface, 'cart'> {
  pdfReceiptLink: string;
  receiptFileName: string;
  finalCapturedOrder: OrdersCapture;
  capturedOrderPaypalID: string;
  canonicalOrderSnapshot?: CanonicalOrderSnapshot | null;
}

export async function savePaymentDataToBackend(encProps: string) {
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
    canonicalOrderSnapshot,
  } = JSON.parse(
    decryptForPostProcessingServerAction(encProps, 'payment-save'),
  ) as PaymentSavingActionProps;

  const canonicalAmountReceived = canonicalOrderSnapshot
    ? getCanonicalPaymentAmountReceived(parseCanonicalOrderSnapshot(canonicalOrderSnapshot))
    : null;

  // The ledger stores PayPal server-SDK payloads, which use camelCase.
  // Keep snake_case fallbacks so older browser-shaped payloads still deserialize safely.
  const purchaseUnits =
    (
      authData as OrderResponseBody & {
        purchaseUnits?: unknown[];
        purchase_units?: unknown[];
      }
    ).purchaseUnits ??
    (
      authData as OrderResponseBody & {
        purchase_units?: unknown[];
      }
    ).purchase_units ??
    [];

  const payer =
    (
      authData as OrderResponseBody & {
        payer?: OrderResponseBody['payer'];
      }
    ).payer ?? null;

  const payerEmail =
    (payer as { emailAddress?: string; email_address?: string } | null)?.emailAddress ??
    (payer as { emailAddress?: string; email_address?: string } | null)?.email_address ??
    null;
  const payerName =
    (payer as { name?: { givenName?: string; surname?: string; given_name?: string } } | null)
      ?.name ?? null;

  const [firstPurchaseUnit = {}] = purchaseUnits;
  const amount =
    (
      firstPurchaseUnit as {
        amount?: { currencyCode?: string; currency_code?: string; value?: string };
      }
    ).amount ?? null;
  const paypalPurchaseUnitCustomId =
    (firstPurchaseUnit as { customId?: string; custom_id?: string }).customId ??
    (firstPurchaseUnit as { customId?: string; custom_id?: string }).custom_id ??
    null;
  const shipping =
    (
      firstPurchaseUnit as {
        shipping?: {
          name?: { fullName?: string; full_name?: string };
        };
      }
    ).shipping ?? null;
  const recepientName = shipping?.name ?? null;
  const recepientEmail = customer?.email;
  const currencyCode = amount?.currencyCode ?? amount?.currency_code ?? null;
  const amountValue = amount?.value ?? null;

  if (!paypalPurchaseUnitCustomId) {
    throw new Error('Missing PayPal customId/custom_id in authorize payload');
  }

  const body = {
    paypal_payload: {
      paymentJSONData: {
        message: 'Data successfully processed!',
        timestamp: new Date().toISOString(),
        capturedOrderPaypalID,
        paymentAuthID: authData.id,
        custom_id: paypalPurchaseUnitCustomId,
        amountReceived:
          canonicalAmountReceived ?? (amount ? `${amountValue} ${currencyCode}` : null),
        payer: payer
          ? {
              payerEmail: payerEmail!,
              payerName:
                `${payerName?.givenName ?? payerName?.given_name ?? ''} ${payerName?.surname ?? ''}`.trim(),
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

  try {
    const data = await universalFetcher<unknown, ReqBody>(`${baseURL}/orders/order-payment`, {
      arg: body satisfies ReqBody,
      fetcherOptions: {
        method: 'POST',
        headers: { ...(await generateSignatureHeaders()) },
      } satisfies FetcherOptions,
    });

    return {
      ...parsePaymentSaveResponse(data, {
        recipientEmail: customer?.email,
        paypalOrderId: capturedOrderPaypalID,
        orderId: ORD_string,
      }),
      ok: true as const,
    };
  } catch (err: FetcherError | { message: string } | unknown) {
    if (err instanceof InvalidPaymentSaveResponseError)
      return { ok: false as const, error: { code: err.code, message: err.message } };
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
}

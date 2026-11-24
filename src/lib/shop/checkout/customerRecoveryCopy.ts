import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import { isAcceptedDjangoFulfillmentProcessResponse } from '@/lib/paypal/txLedger/fulfillmentProcessResponse';
import {
  customerPostPurchaseDescriptions,
  type CustomerPostPurchaseStage,
} from './customerPostPurchaseStage';
import type { CustomerFulfillmentLookup } from './readCustomerFulfillmentMilestone';

export function getCustomerFulfillmentLookup(
  row: {
    orderToken: string;
    status: string;
    djangoPaymentSaveCustomId: string | null;
    merchizeFulfillmentResponsePayload: unknown;
    fulfillmentAddressOverriddenAt: Date | null;
  },
  paymentConfirmed: boolean,
): CustomerFulfillmentLookup | null {
  if (
    !paymentConfirmed ||
    row.status === PAYPAL_LEDGER_STATUS.REFUNDED ||
    !row.djangoPaymentSaveCustomId ||
    !isAcceptedDjangoFulfillmentProcessResponse(row.merchizeFulfillmentResponsePayload)
  ) return null;
  return {
    orderToken: row.orderToken,
    djangoPaymentSaveCustomId: row.djangoPaymentSaveCustomId,
    addressChangedAt: row.fulfillmentAddressOverriddenAt,
  };
}

export function getCustomerPostPurchaseStage({
  status,
  lastErrorCode,
  fulfillmentResponse,
  paymentConfirmed,
  postPaymentComplete,
}: {
  status: string;
  lastErrorCode: string | null | undefined;
  fulfillmentResponse: unknown;
  paymentConfirmed: boolean;
  postPaymentComplete: boolean;
}): CustomerPostPurchaseStage | null {
  if (
    !paymentConfirmed ||
    postPaymentComplete ||
    status === PAYPAL_LEDGER_STATUS.REFUNDED ||
    status === PAYPAL_LEDGER_STATUS.COMPLETED ||
    !isAcceptedDjangoFulfillmentProcessResponse(fulfillmentResponse)
  )
    return null;

  if (lastErrorCode === 'MERCHIZE_ADDRESS_VALIDATION_PENDING') return 'checking_delivery_details';
  if (
    ['MERCHIZE_PUSH_DISABLED_BY_CONFIG', 'MERCHIZE_MANUAL_RELEASE_REQUIRED'].includes(
      lastErrorCode ?? '',
    )
  )
    return 'awaiting_preparation';
  return status === PAYPAL_LEDGER_STATUS.PAYMENT_SAVED &&
    (!lastErrorCode || lastErrorCode === 'MERCHIZE_PUSH_VERIFICATION_PENDING')
    ? 'order_received'
    : null;
}

export function getCustomerRecoveryReason(
  status: string,
  lastErrorCode: string | null | undefined,
  receiptReady: boolean,
) {
  if (lastErrorCode === 'MERCHIZE_ADDRESS_VALIDATION_PENDING') {
    return customerPostPurchaseDescriptions.checking_delivery_details;
  }
  if (
    ['MERCHIZE_PUSH_DISABLED_BY_CONFIG', 'MERCHIZE_MANUAL_RELEASE_REQUIRED'].includes(
      lastErrorCode ?? '',
    )
  ) {
    return customerPostPurchaseDescriptions.awaiting_preparation;
  }
  if (status === PAYPAL_LEDGER_STATUS.CAPTURED) {
    return receiptReady
      ? 'Your payment is confirmed and your receipt is ready. We’re still confirming your order.'
      : 'Your payment was received. Your receipt is taking longer than expected.';
  }
  if (
    status === PAYPAL_LEDGER_STATUS.RECEIPT_UPLOADED ||
    status === PAYPAL_LEDGER_STATUS.PAYMENT_SAVED
  ) {
    return 'Your payment is confirmed. We’re still confirming your order before preparation can start.';
  }
  return 'Your order is taking longer than expected. Keep your order reference for support.';
}

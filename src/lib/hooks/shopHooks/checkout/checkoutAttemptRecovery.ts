import {
  clearCheckoutAttempt,
  isCurrentCheckoutAttempt,
  usePayPalIntentStore,
  type CheckoutAttempt,
} from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import type { PayPalTxPaymentStatusResponse } from '@/lib/paypal/txLedger/mapLedgerToProcessingState';
import { isPayPalAttemptFinalizing } from './finalizePayPalAttempt';

/** A separate order requires fresh unpaid evidence and an explicit customer action. */
export function canStartSeparateCheckout(
  attempt: CheckoutAttempt,
  status: PayPalTxPaymentStatusResponse,
) {
  const stage = usePayPalIntentStore.getState().activeCheckout?.stage;
  return (
    isCurrentCheckoutAttempt(attempt) &&
    !isPayPalAttemptFinalizing(attempt) &&
    (!stage ||
      ['paypal_order_created', 'paypal_window_opened', 'paypal_cancelled'].includes(stage)) &&
    status.orderToken === attempt.orderToken &&
    status.status === 'intent_created' &&
    (!status.lastEventType || status.lastEventType === 'CHECKOUT.ORDER.CREATED') &&
    !status.error &&
    !status.cartPurchase &&
    !status.paidAmountLabel &&
    !status.customerRecoveryStatus &&
    !status.processingCompletedAt &&
    !status.receiptLink &&
    !status.receiptFile &&
    !status.djangoPaymentSaveCustomId
  );
}

export function startSeparateCheckout(
  attempt: CheckoutAttempt,
  status: PayPalTxPaymentStatusResponse,
) {
  return canStartSeparateCheckout(attempt, status) && clearCheckoutAttempt(attempt);
}

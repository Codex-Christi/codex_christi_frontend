import {
  isCurrentCheckoutAttempt,
  setCheckoutAttemptStage,
  usePayPalIntentStore,
  type CheckoutAttempt,
} from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import type { OrderAuthorizeResponse, OrdersCapture } from '@paypal/paypal-server-sdk';
import { boundedCheckoutRequest, CheckoutRequestTimeoutError } from './boundedCheckoutRequest';

const finalizing = new Map<string, Promise<'completed' | 'superseded'>>();
export const isPayPalAttemptFinalizing = (attempt: CheckoutAttempt) =>
  finalizing.has(attempt.attemptId);
export class PayPalCheckoutError extends Error {}

/** Bind approval to the provider order and stop old attempts at every asynchronous boundary. */
export function finalizePayPalAttempt(
  attempt: CheckoutAttempt,
  orderID: string,
  {
    request = fetch,
    onCompleted,
    timeoutMs,
  }: {
    request?: typeof fetch;
    onCompleted: (orderToken: string) => void;
    timeoutMs?: number;
  },
): Promise<'completed' | 'superseded'> {
  if (!isCurrentCheckoutAttempt(attempt)) return Promise.resolve('superseded');
  if (!attempt.orderToken || !attempt.paypalOrderId || attempt.paypalOrderId !== orderID)
    return Promise.reject(
      new PayPalCheckoutError('This payment attempt changed. Review checkout before continuing.'),
    );
  const existing = finalizing.get(attempt.attemptId);
  if (existing) return existing;
  const stage = usePayPalIntentStore.getState().activeCheckout?.stage;
  if (stage && ['paypal_approved', 'capture_checking', 'confirmation_opened'].includes(stage))
    return Promise.reject(
      new PayPalCheckoutError(
        'This payment is already being checked. Check its status before trying again.',
      ),
    );
  const operation = (async () => {
    setCheckoutAttemptStage(attempt, 'paypal_approved');
    const authData = await boundedCheckoutRequest(async (signal) => {
      const response = await request('/next-api/paypal/orders/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderToken: attempt.orderToken, orderID }),
        signal,
      });
      if (!isCurrentCheckoutAttempt(attempt)) return null;
      if (!response.ok)
        throw new PayPalCheckoutError(
          'Payment authorization could not be confirmed. Check its status before trying again.',
        );
      return (await response.json()) as OrderAuthorizeResponse;
    }, timeoutMs);
    if (!isCurrentCheckoutAttempt(attempt)) return 'superseded' as const;
    const authorizationId = authData?.purchaseUnits?.[0]?.payments?.authorizations?.[0]?.id;
    if (!authorizationId)
      throw new PayPalCheckoutError('Payment authorization could not be confirmed.');
    setCheckoutAttemptStage(attempt, 'capture_checking');
    const captured = await boundedCheckoutRequest(async (signal) => {
      const response = await request('/next-api/paypal/orders/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderToken: attempt.orderToken, authorizationId }),
        signal,
      });
      if (!isCurrentCheckoutAttempt(attempt)) return null;
      if (!response.ok)
        throw new PayPalCheckoutError(
          'Payment status could not be confirmed. Check your payment before trying again.',
        );
      return (await response.json()) as OrdersCapture;
    }, timeoutMs);
    if (!isCurrentCheckoutAttempt(attempt)) return 'superseded' as const;
    if (captured?.status !== 'COMPLETED')
      throw new PayPalCheckoutError(
        'Payment is still being confirmed. Check its status before trying again.',
      );
    setCheckoutAttemptStage(attempt, 'confirmation_opened');
    onCompleted(attempt.orderToken!);
    return 'completed' as const;
  })().catch((error: unknown) => {
    if (error instanceof CheckoutRequestTimeoutError)
      throw new PayPalCheckoutError(
        'Payment confirmation is taking longer than expected. Check its status before trying again.',
      );
    throw error;
  });
  finalizing.set(attempt.attemptId, operation);
  void operation.then(
    () => finalizing.delete(attempt.attemptId),
    () => finalizing.delete(attempt.attemptId),
  );
  return operation;
}

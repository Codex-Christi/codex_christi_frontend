import useAuthStore from '@/stores/authStore';
import { getAuthGeneration } from '@/lib/auth/session-generation';
import {
  captureCheckoutAttempt,
  isCurrentCheckoutAttempt,
  usePayPalIntentStore,
  type ActivePayPalCheckoutStage,
  type CheckoutAttempt,
} from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import type { OriginalCheckout } from '@/lib/shop/checkout/originalCheckout';
import { boundedCheckoutRequest } from './boundedCheckoutRequest';
import { claimCurrentCheckout } from './claimCurrentCheckout';

export const canReopenCheckoutPayment = (stage?: ActivePayPalCheckoutStage) =>
  !stage || ['paypal_order_created', 'paypal_window_opened', 'paypal_cancelled'].includes(stage);

export function originalCheckoutScope() {
  const auth = useAuthStore.getState();
  return `${getAuthGeneration()}:${auth.isAuthenticated ? auth.accountOwnerId : 'guest'}:${captureCheckoutAttempt()?.attemptId ?? ''}`;
}

function isOriginalCheckout(value: unknown): value is OriginalCheckout {
  if (!value || typeof value !== 'object') return false;
  const checkout = value as OriginalCheckout;
  return Boolean(
    typeof checkout.reviewKey === 'string' &&
    checkout.reviewKey &&
    typeof checkout.customer?.name === 'string' &&
    typeof checkout.customer.email === 'string' &&
    checkout.deliveryAddress &&
    [
      'shipping_address_line_1',
      'shipping_city',
      'shipping_state',
      'shipping_country',
      'zip_code',
    ].every(
      (key) =>
        typeof checkout.deliveryAddress[key as keyof OriginalCheckout['deliveryAddress']] ===
        'string',
    ) &&
    typeof checkout.countryCode === 'string' &&
    /^[A-Z]{2}$/u.test(checkout.countryCode) &&
    typeof checkout.quote?.currency === 'string' &&
    /^[A-Z]{3}$/u.test(checkout.quote.currency) &&
    [checkout.quote.subtotal, checkout.quote.shipping, checkout.quote.total].every(
      (amount) => typeof amount === 'number' && Number.isFinite(amount) && amount >= 0,
    ) &&
    Array.isArray(checkout.lines) &&
    checkout.lines.length > 0 &&
    checkout.lines.every(
      (line) =>
        line !== null &&
        typeof line === 'object' &&
        typeof line.id === 'string' &&
        typeof line.title === 'string' &&
        (line.image === null || typeof line.image === 'string') &&
        typeof line.options === 'string' &&
        Number.isSafeInteger(line.quantity) &&
        line.quantity > 0 &&
        typeof line.unitAmount === 'string' &&
        typeof line.lineAmount === 'string' &&
        /^\d+(?:\.\d+)?$/u.test(line.unitAmount) &&
        /^\d+(?:\.\d+)?$/u.test(line.lineAmount),
    ),
  );
}

/** Read the bound purchase independently of the live cart, quote, and delivery draft. */
export async function loadOriginalCheckout(
  attempt: CheckoutAttempt,
  { request = fetch, timeoutMs }: { request?: typeof fetch; timeoutMs?: number } = {},
): Promise<OriginalCheckout> {
  const scope = originalCheckoutScope();
  const current = () => {
    const stored = captureCheckoutAttempt();
    return (
      isCurrentCheckoutAttempt(attempt) &&
      originalCheckoutScope() === scope &&
      stored?.orderToken === attempt.orderToken &&
      stored?.paypalOrderId === attempt.paypalOrderId
    );
  };
  const assertCurrent = () => {
    if (!current()) throw new Error('This checkout changed. Reopen its order status.');
    if (!canReopenCheckoutPayment(usePayPalIntentStore.getState().activeCheckout?.stage))
      throw new Error('This payment already needs checking. Open its order status before paying.');
  };
  assertCurrent();
  if (!attempt.orderToken || !attempt.paypalOrderId)
    throw new Error('Reopen the original checkout using its order reference.');
  if (
    useAuthStore.getState().isAuthenticated &&
    !(await claimCurrentCheckout(request, { timeoutMs }))
  )
    throw new Error('We couldn’t link this checkout yet. Check your connection and try again.');
  assertCurrent();
  const result = await boundedCheckoutRequest(async (signal) => {
    const response = await request(
      `/next-api/shop/checkout/${encodeURIComponent(attempt.orderToken!)}/resume`,
      { cache: 'no-store', signal },
    );
    if (!response.ok)
      throw new Error('This checkout needs a status check before payment can continue.');
    return (await response.json()) as { checkout?: unknown };
  }, timeoutMs);
  assertCurrent();
  const checkout = result?.checkout;
  if (
    !isOriginalCheckout(checkout) ||
    checkout.orderToken !== attempt.orderToken ||
    checkout.paypalOrderId !== attempt.paypalOrderId
  )
    throw new Error('The original purchase could not be confirmed. Open its order status.');
  return checkout;
}

/** Recheck the saved purchase immediately before returning its existing provider order. */
export async function resumeOriginalPayPalOrder(
  reviewed: OriginalCheckout,
  attempt: CheckoutAttempt,
  options?: Parameters<typeof loadOriginalCheckout>[1],
) {
  const current = await loadOriginalCheckout(attempt, options);
  if (current.reviewKey !== reviewed.reviewKey)
    throw new Error('The saved purchase changed. Reopen it and review the details again.');
  return current.paypalOrderId;
}

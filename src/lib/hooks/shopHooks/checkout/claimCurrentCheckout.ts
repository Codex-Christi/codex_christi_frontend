import useAuthStore from '@/stores/authStore';
import {
  captureCheckoutAttempt,
  isCurrentCheckoutAttempt,
} from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import { boundedCheckoutRequest } from './boundedCheckoutRequest';

const claims = new Map<string, Promise<boolean>>();
/** Claiming changes ownership only; a failed request never restarts or cancels payment. */
export function claimCurrentCheckout(
  request: typeof fetch = fetch,
  { timeoutMs }: { timeoutMs?: number } = {},
): Promise<boolean> {
  const owner = useAuthStore.getState();
  const ownerId = owner.isAuthenticated ? owner.accountOwnerId : null;
  const attempt = captureCheckoutAttempt();
  if (!ownerId || !attempt?.orderToken) return Promise.resolve(false);
  const current = () =>
    isCurrentCheckoutAttempt(attempt) &&
    useAuthStore.getState().isAuthenticated &&
    useAuthStore.getState().accountOwnerId === ownerId;
  const key = `${attempt.attemptId}:${ownerId}`;
  const pending = claims.get(key);
  if (pending) return pending;
  const operation = (async () => {
    try {
      const response = await boundedCheckoutRequest(
        (signal) =>
          request('/next-api/shop/checkout/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderToken: attempt.orderToken }),
            signal,
          }),
        timeoutMs,
      );
      return response.ok && current();
    } catch {
      return false;
    }
  })();
  claims.set(key, operation);
  void operation.then((claimed) => {
    if (!claimed) claims.delete(key);
  });
  return operation;
}

import assert from 'node:assert/strict';
import test from 'node:test';
import useAuthStore from '@/stores/authStore';
import {
  beginCheckoutAttempt,
  completeCheckoutAttempt,
  usePayPalIntentStore,
} from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import { deferred } from '@/lib/cart/test-support';
import { claimCurrentCheckout } from './claimCurrentCheckout';

usePayPalIntentStore.persist.setOptions({
  storage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
});
function setup(key: string) {
  usePayPalIntentStore.getState().clearIntent();
  useAuthStore.setState({ isAuthenticated: true, accountOwnerId: 'alice' });
  const attempt = beginCheckoutAttempt(key);
  completeCheckoutAttempt(attempt, { orderToken: `token-${key}`, paypalOrderId: `paypal-${key}` });
}

test('sign-in claims an existing attempt once while concurrent UI mounts share the request', async () => {
  setup('claim-once');
  const gate = deferred<Response>();
  let requests = 0;
  const request: typeof fetch = async (_url, init) => {
    requests += 1;
    assert.deepEqual(JSON.parse(String(init?.body)), { orderToken: 'token-claim-once' });
    return gate.promise;
  };
  const first = claimCurrentCheckout(request);
  const second = claimCurrentCheckout(request);
  assert.equal(first, second);
  gate.resolve(Response.json({ ok: true }));
  assert.equal(await first, true);
  assert.equal(await claimCurrentCheckout(request), true);
  assert.equal(requests, 1);
});

test('claim failure leaves the payment intact and allows a later retry', async () => {
  setup('claim-retry');
  assert.equal(
    await claimCurrentCheckout(async () => {
      throw new Error('offline');
    }),
    false,
  );
  assert.equal(usePayPalIntentStore.getState().orderToken, 'token-claim-retry');
  assert.equal(await claimCurrentCheckout(async () => Response.json({ ok: true })), true);
});

test('a claim finishing after account switch or a new attempt cannot count as current ownership', async () => {
  setup('claim-obsolete');
  const gate = deferred<Response>();
  const work = claimCurrentCheckout(async () => gate.promise);
  useAuthStore.setState({ accountOwnerId: 'bob' });
  usePayPalIntentStore.getState().clearIntent();
  beginCheckoutAttempt('another-attempt');
  gate.resolve(Response.json({ ok: true }));
  assert.equal(await work, false);
  assert.equal(usePayPalIntentStore.getState().checkoutAttempt?.inputKey, 'another-attempt');
});

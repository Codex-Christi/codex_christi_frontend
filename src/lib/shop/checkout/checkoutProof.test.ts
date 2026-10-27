import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canAccessCheckout,
  checkoutAddressHash,
  checkoutAttemptToken,
  createCheckoutGrant,
  matchesCheckoutProof,
  openCheckoutValue,
  readUpstreamEmailProof,
  sealCheckoutValue,
  type CheckoutEmailProof,
  type CheckoutGrant,
} from './checkoutProof';
import {
  checkoutInputFingerprint,
  readReviewedCheckoutQuote,
  requireMatchingReview,
} from './checkoutReview';
import { CheckoutRequestError, readCheckoutBody } from './serverRequest';
import type { CanonicalOrderSnapshot } from '@/lib/paypal/orderSnapshot/types';

const address = {
  shipping_address_line_1: '12 Main Road',
  shipping_address_line_2: '',
  shipping_city: 'Lagos',
  shipping_state: 'Lagos',
  shipping_country: 'NGA',
  zip_code: '100001',
};
const upstream = {
  success: true,
  data: {
    id: 'django-uuid',
    order_id: 'ORD-123',
    email: 'customer@example.com',
    address: '12 Main Road',
    address_2: '',
    city: 'Lagos',
    state: 'Lagos',
    country: 'NG',
    zip_code: '100001',
    otp_status: 'verified',
  },
};
const quote = { currency: 'USD', subtotal: 20, shipping: 5, total: 25 };

function signingSecret(t: test.TestContext) {
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'checkout-test-secret-with-at-least-32-bytes';
  t.after(() => {
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  });
}

test('only complete successful upstream evidence binds the verified email and exact address', () => {
  const proof = readUpstreamEmailProof(upstream, 'customer@example.com');
  assert.equal(matchesCheckoutProof(proof, ' Customer@Example.com ', address), true);
  assert.equal(matchesCheckoutProof(proof, 'other@example.com', address), false);
  assert.equal(
    matchesCheckoutProof(proof, proof.email, {
      ...address,
      shipping_address_line_1: '99 Other Road',
    }),
    false,
  );
  assert.equal(matchesCheckoutProof({ ...proof, verified: false }, proof.email, address), false);
  assert.throws(() => readUpstreamEmailProof({ ...upstream, success: false }, proof.email));
  assert.throws(() =>
    readUpstreamEmailProof(
      { success: true, data: { ...upstream.data, order_id: null } },
      proof.email,
    ),
  );
  assert.throws(() => readUpstreamEmailProof(upstream, 'attacker@example.com'));
  assert.equal(
    checkoutAddressHash(address),
    checkoutAddressHash({
      ...address,
      shipping_country: 'NG',
      shipping_address_line_1: ' 12 MAIN  ROAD ',
    }),
  );
});

test('proofs and grants reject tampering, expiry and cross-purpose reuse', (t) => {
  signingSecret(t);
  const proof = readUpstreamEmailProof(upstream, 'customer@example.com');
  const token = sealCheckoutValue(proof, 'email-proof', 60);
  assert.deepEqual(openCheckoutValue<CheckoutEmailProof>(token, 'email-proof'), proof);
  assert.equal(openCheckoutValue(token, 'access'), null);
  assert.equal(openCheckoutValue(token + 'x', 'email-proof'), null);
  assert.equal(openCheckoutValue(sealCheckoutValue(proof, 'email-proof', -1), 'email-proof'), null);
});

test('attempt IDs stay stable across re-verification and are isolated by trusted browser scope', (t) => {
  signingSecret(t);
  const proof = {
    ...readUpstreamEmailProof(upstream, 'customer@example.com'),
    browserId: 'browser-a',
  };
  const attempt = 'a2ae19e4-f3e8-4f0c-a64e-357aab465c9e';
  const token = checkoutAttemptToken(attempt, proof);
  assert.equal(checkoutAttemptToken(attempt.toUpperCase(), proof), token);
  assert.equal(checkoutAttemptToken(attempt, { ...proof, intentUuid: 'other-intent' }), token);
  assert.notEqual(checkoutAttemptToken(attempt, { ...proof, browserId: 'browser-b' }), token);
  assert.throws(() => checkoutAttemptToken('known-value', proof), CheckoutRequestError);
});

test('guest login preserves its grant, account logout isolates payment grants, OTP grants only read status', (t) => {
  signingSecret(t);
  const guest = { orderToken: 'order-a', userId: null };
  const guestGrant = openCheckoutValue<CheckoutGrant>(
    createCheckoutGrant(guest, 'payment'),
    'access',
  );
  assert.equal(canAccessCheckout(guestGrant, guest, 'new-account', true), true);
  assert.equal(canAccessCheckout(guestGrant, { ...guest, orderToken: 'order-b' }, null), false);
  const account = { orderToken: 'account-order', userId: 'alice' };
  const accountGrant = openCheckoutValue<CheckoutGrant>(
    createCheckoutGrant(account, 'payment'),
    'access',
  );
  assert.equal(canAccessCheckout(accountGrant, account, null), false);
  assert.equal(canAccessCheckout(null, account, 'alice', true), true);
  assert.equal(canAccessCheckout(accountGrant, account, 'bob', true), false);
  const recovery = openCheckoutValue<CheckoutGrant>(
    createCheckoutGrant(account, 'status'),
    'access',
  );
  assert.equal(canAccessCheckout(recovery, account, null), true);
  assert.equal(canAccessCheckout(recovery, account, null, true), false);
});

test('review acknowledgment and exact canonical price changes are checked independently', () => {
  assert.throws(
    () => readReviewedCheckoutQuote({ acknowledged: false, quote }),
    CheckoutRequestError,
  );
  assert.throws(() =>
    readReviewedCheckoutQuote({ acknowledged: true, quote: { ...quote, total: NaN } }),
  );
  const snapshot = {
    currency: 'USD',
    subtotal: { value: '20.00' },
    shipping: { value: '5.00' },
    total: { value: '25.00' },
  } as CanonicalOrderSnapshot;
  requireMatchingReview(snapshot, readReviewedCheckoutQuote({ acknowledged: true, quote }));
  assert.throws(
    () => requireMatchingReview(snapshot, { ...quote, total: 24.99 }),
    (error: unknown) =>
      error instanceof CheckoutRequestError && error.code === 'CHECKOUT_REVIEW_CHANGED',
  );
  const input = {
    email: 'customer@example.com',
    name: 'Customer',
    address,
    quote,
    selections: [{ productId: 'p', variantId: 'v', quantity: 2 }],
  };
  const fingerprint = checkoutInputFingerprint(input);
  assert.equal(
    checkoutInputFingerprint({
      ...input,
      selections: [{ quantity: 2, variantId: 'v', productId: 'p', untrustedPrice: 0.01 }],
    }),
    fingerprint,
  );
  assert.notEqual(
    checkoutInputFingerprint({
      ...input,
      selections: [{ productId: 'p', variantId: 'v', quantity: 3 }],
    }),
    fingerprint,
  );
});

test('mutation guards reject foreign origins, malformed and oversized streamed JSON', async (t) => {
  const previous = process.env.NODE_ENV;
  Reflect.set(process.env, 'NODE_ENV', 'development');
  t.after(() => {
    if (previous === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV');
    else Reflect.set(process.env, 'NODE_ENV', previous);
  });
  const request = (body: string, origin = 'http://192.168.1.5:3000') =>
    new Request('http://192.168.1.5:3000/next-api/shop/checkout', {
      method: 'POST',
      headers: { origin, host: '192.168.1.5:3000', 'content-type': 'application/json' },
      body,
    });
  assert.deepEqual(await readCheckoutBody(request('{"email":"ok"}')), { email: 'ok' });
  await assert.rejects(
    readCheckoutBody(request('{}', 'https://evil.test')),
    (error: unknown) => error instanceof CheckoutRequestError && error.status === 403,
  );
  await assert.rejects(readCheckoutBody(request('not-json')), CheckoutRequestError);
  await assert.rejects(
    readCheckoutBody(request('{"a":"' + 'x'.repeat(100) + '"}'), 64),
    (error: unknown) => error instanceof CheckoutRequestError && error.status === 413,
  );
});

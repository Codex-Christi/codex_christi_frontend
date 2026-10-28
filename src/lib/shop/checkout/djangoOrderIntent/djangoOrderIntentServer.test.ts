import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { handleDjangoOrderIntent } from './djangoOrderIntentServer';
import {
  CHECKOUT_BROWSER_COOKIE,
  emailProofCookieName,
  openCheckoutValue,
  readUpstreamEmailProof,
  sealCheckoutValue,
  type CheckoutEmailProof,
} from '../checkoutProof';

const email = 'checkout@example.test';
const fields = {
  email,
  first_name: 'Test',
  last_name: 'Customer',
  address: '12 Main Road',
  city: 'San Jose',
  state: 'CA',
  zip_code: '95131',
  country: 'USA',
};
const upstream = {
  success: true,
  data: { ...fields, id: 'intent-one', order_id: 'order-one', otp_status: 'verified' },
};
const browserId = 'browser-one';

type Dependencies = NonNullable<Parameters<typeof handleDjangoOrderIntent>[2]>;
function harness(t: TestContext) {
  const secret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'checkout-handler-test-secret-of-at-least-32-bytes';
  t.after(() => {
    if (secret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = secret;
  });
  const values = new Map<string, string>();
  let payload: unknown = upstream;
  const sent: CheckoutEmailProof[] = [];
  const forwarded: Array<{ endpoint: string; body: unknown }> = [];
  const consumed: Array<{ email: string; otp: string; scope: string | undefined }> = [];
  let userId: string | null = null;
  const dependencies: Dependencies = {
    getCookies: async () => ({
      get: (name: string) => (values.has(name) ? { name, value: values.get(name)! } : undefined),
    }),
    post: async (endpoint, body) => {
      forwarded.push({ endpoint, body });
      return { response: new Response(null, { status: 200 }), payload };
    },
    sendCode: async (proof) => {
      sent.push(proof);
      return {
        otp: '123456',
        expiresAt: new Date(Date.now() + 600_000),
        cooldown: 60,
        hasActiveChallenge: true,
      };
    },
    consumeCode: async (email, otp, scope) => {
      consumed.push({ email, otp, scope });
      return otp === '123456' ? 'verified' : 'invalid';
    },
    getUserId: async () => userId,
  };
  const request = (body: unknown) =>
    new Request('http://localhost:3000/next-api/shop/checkout/django-order-intent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify(body),
    });
  const run = (
    body: unknown,
    endpoint: Parameters<typeof handleDjangoOrderIntent>[1] = '/orders/intent',
  ) => handleDjangoOrderIntent(request(body), endpoint, dependencies);
  return {
    values,
    sent,
    forwarded,
    consumed,
    run,
    setPayload: (value: unknown) => {
      payload = value;
    },
    setUserId: (value: string | null) => {
      userId = value;
    },
  };
}

test('a reused verified Django intent requires a fresh browser-bound checkout code', async (t) => {
  const h = harness(t);
  const result = await h.run(fields);
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.data.otp_status, 'pending');
  assert.equal(body.emailVerificationMethod, 'next-otp');
  assert.equal(h.sent.length, 1);
  const pendingCookie = result.cookies.get(emailProofCookieName('intent-one'))!;
  const pending = openCheckoutValue<CheckoutEmailProof>(pendingCookie.value, 'email-proof')!;
  assert.equal(pending.verified, false);
  assert.equal(pending.verificationMethod, 'next-otp');
  for (const cookie of result.cookies.getAll()) h.values.set(cookie.name, cookie.value);
  const verified = await h.run(
    { email, intentUuid: 'intent-one', order_id: 'order-one', otp: '123456' },
    '/orders/intent/verify',
  );
  assert.equal(verified.status, 200);
  assert.equal((await verified.json()).data.otp_status, 'verified');
  assert.equal(h.forwarded.length, 1, 'Next verification does not retry a stale Django code');
  assert.equal(h.consumed.length, 1);
  assert.ok(h.consumed[0].scope?.includes(pending.browserId!));
  assert.equal(
    openCheckoutValue<CheckoutEmailProof>(
      verified.cookies.get(pendingCookie.name)!.value,
      'email-proof',
    )?.verified,
    true,
  );
});

test('matching existing verified proof is reused without sending a code or extending its expiry', async (t) => {
  const h = harness(t);
  const proof = { ...readUpstreamEmailProof(upstream, email), browserId, ownerId: null };
  h.values.set(CHECKOUT_BROWSER_COOKIE, sealCheckoutValue(browserId, 'browser', 3600));
  h.values.set(emailProofCookieName(proof.intentUuid), sealCheckoutValue(proof, 'email-proof', 60));
  const result = await h.run(fields);
  assert.equal((await result.json()).data.otp_status, 'verified');
  assert.equal(h.sent.length, 0);
  assert.equal(result.cookies.get(emailProofCookieName(proof.intentUuid)), undefined);
});

test('verification cannot bypass the pending browser and exact intent identity', async (t) => {
  const h = harness(t);
  const missing = await h.run(
    { email, intentUuid: 'intent-one', order_id: 'order-one', otp: '123456' },
    '/orders/intent/verify',
  );
  assert.equal(missing.status, 409);
  assert.equal(h.forwarded.length, 0);
  const pending = await h.run(fields);
  for (const cookie of pending.cookies.getAll()) h.values.set(cookie.name, cookie.value);
  for (const changed of [
    { intentUuid: 'different-intent' },
    { order_id: 'different-order' },
    { email: 'different@example.test' },
  ]) {
    const result = await h.run(
      { email, intentUuid: 'intent-one', order_id: 'order-one', otp: '123456', ...changed },
      '/orders/intent/verify',
    );
    assert.equal(result.status, 409);
  }
  h.values.set(CHECKOUT_BROWSER_COOKIE, sealCheckoutValue('another-browser', 'browser', 3600));
  const wrongBrowser = await h.run(
    { email, intentUuid: 'intent-one', order_id: 'order-one', otp: '123456' },
    '/orders/intent/verify',
  );
  assert.equal(wrongBrowser.status, 409);
  assert.equal(h.consumed.length, 0);
});

test('normal Django verification must preserve the pending address and order identity', async (t) => {
  const h = harness(t);
  h.setPayload({ ...upstream, data: { ...upstream.data, otp_status: 'pending' } });
  const pending = await h.run(fields);
  assert.equal(h.sent.length, 0);
  for (const cookie of pending.cookies.getAll()) h.values.set(cookie.name, cookie.value);
  h.setPayload({ ...upstream, data: { ...upstream.data, address: 'Different Street' } });
  const mismatched = await h.run(
    { email, intentUuid: 'intent-one', order_id: 'order-one', otp: '123456' },
    '/orders/intent/verify',
  );
  assert.equal(mismatched.status, 409);
  assert.equal(mismatched.cookies.get(emailProofCookieName('intent-one')), undefined);
  h.setPayload(upstream);
  const verified = await h.run(
    { email, intentUuid: 'intent-one', order_id: 'order-one', otp: '123456' },
    '/orders/intent/verify',
  );
  assert.equal(verified.status, 200);
  assert.deepEqual(h.forwarded.at(-1)?.body, { email, otp: '123456', order_id: 'order-one' });
});

test('expired intents keep a browser-bound resend path and preserve the Django wire contract', async (t) => {
  const h = harness(t);
  h.setPayload({ ...upstream, data: { ...upstream.data, otp_status: 'expired' } });
  const result = await h.run(fields);
  assert.equal(result.status, 200);
  assert.equal(
    openCheckoutValue<CheckoutEmailProof>(
      result.cookies.get(emailProofCookieName('intent-one'))?.value,
      'email-proof',
    )?.verified,
    false,
  );
  for (const cookie of result.cookies.getAll()) h.values.set(cookie.name, cookie.value);
  h.setPayload({ success: true, message: 'Sent' });
  const resent = await h.run({ email, intentUuid: 'intent-one' }, '/orders/intent/resend-otp');
  assert.equal(resent.status, 200);
  assert.deepEqual(h.forwarded.at(-1), { endpoint: '/orders/intent/resend-otp', body: { email } });
});

test('guest verification is claimed by sign-in and cannot be reused after logout or account change', async (t) => {
  const h = harness(t);
  const created = await h.run(fields);
  for (const cookie of created.cookies.getAll()) h.values.set(cookie.name, cookie.value);
  h.setUserId('account-a');
  const verified = await h.run(
    { email, intentUuid: 'intent-one', order_id: 'order-one', otp: '123456' },
    '/orders/intent/verify',
  );
  assert.equal(verified.status, 200);
  const proofCookie = verified.cookies.get(emailProofCookieName('intent-one'))!;
  assert.equal(
    openCheckoutValue<CheckoutEmailProof>(proofCookie.value, 'email-proof')?.ownerId,
    'account-a',
  );
  for (const cookie of verified.cookies.getAll()) h.values.set(cookie.name, cookie.value);
  const repeat = await h.run(
    { email, intentUuid: 'intent-one', order_id: 'order-one', otp: '123456' },
    '/orders/intent/verify',
  );
  assert.equal(repeat.status, 200);
  assert.equal(
    repeat.cookies.get(proofCookie.name),
    undefined,
    'repeating verification cannot renew its expiry',
  );
  for (const nextOwner of [null, 'account-b']) {
    h.setUserId(nextOwner);
    const denied = await h.run(
      { email, intentUuid: 'intent-one', order_id: 'order-one', otp: '123456' },
      '/orders/intent/verify',
    );
    assert.equal(denied.status, 409);
  }
  assert.equal(h.consumed.length, 1);
});

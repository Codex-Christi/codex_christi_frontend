import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { NextRequest } from 'next/server';
import { createRequestStoreForAPI } from 'next/dist/server/async-storage/request-store';
import {
  workAsyncStorage,
  type WorkStore,
} from 'next/dist/server/app-render/work-async-storage.external';
import { workUnitAsyncStorage } from 'next/dist/server/app-render/work-unit-async-storage.external';
import type { PrismaClient } from '@/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client';
import { POST as intent } from '@/app/api/paypal/tx-ledger/intent/route';
import { POST as claim } from '@/app/api/shop/checkout/claim/route';
import { GET as status } from '@/app/api/paypal/tx-ledger/payments/[orderToken]/status/route';
import { findEmailRecoveryCheckouts } from './checkoutRecovery/findEmailRecoveryCheckouts';
import { handleDjangoOrderIntent } from './djangoOrderIntent/djangoOrderIntentServer';
import {
  CHECKOUT_BROWSER_COOKIE,
  checkoutAttemptToken,
  checkoutGrantCookieName,
  emailProofCookieName,
  readUpstreamEmailProof,
  sealCheckoutValue,
  createCheckoutGrant,
  openCheckoutValue,
  type CheckoutEmailProof,
} from './checkoutProof';
import { checkoutInputFingerprint } from './checkoutReview';
import { buildAuthSessionCookies } from '@/lib/session/session-cookies';

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
const body = {
  attemptId: 'a2ae19e4-f3e8-4f0c-a64e-357aab465c9e',
  djangoOrderIntentUuid: 'django-uuid',
  selections: [{ productId: 'p', variantId: 'v', quantity: 2 }],
  customer: { name: 'Customer', email: 'customer@example.com' },
  delivery_address: address,
  review: { acknowledged: true, quote },
};

function setup(t: TestContext) {
  const previous = global.__paypalTxLedger__;
  for (const [key, value] of Object.entries({
    NODE_ENV: 'development',
    SESSION_SECRET: 'checkout-server-test-secret-at-least-32-bytes',
    DJANGO_INTERNAL_BASE_URL: 'https://mock.invalid/api/v1',
    SHOP_CHECKOUT_OTP_VERIFICATION_API_KEY: 'mock-key',
  })) {
    const old = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (old === undefined) delete process.env[key];
      else process.env[key] = old;
    });
  }
  t.after(() => {
    global.__paypalTxLedger__ = previous;
  });
  const proof = {
    ...readUpstreamEmailProof(upstream, body.customer.email),
    browserId: 'browser-a',
    ownerId: null,
  };
  const proofCookies = `${CHECKOUT_BROWSER_COOKIE}=${sealCheckoutValue('browser-a', 'browser', 60)}; ${emailProofCookieName(proof.intentUuid)}=${sealCheckoutValue(proof, 'email-proof', 60)}`;
  return { proof, proofCookies };
}

function request(input: unknown, cookie = '', path = '/next-api/paypal/tx-ledger/intent') {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      'content-type': 'application/json',
      cookie,
    },
    body: JSON.stringify(input),
  });
}

function inRequest<T>(req: NextRequest, run: () => Promise<T>) {
  const store = createRequestStoreForAPI(
    req,
    req.nextUrl,
    { tags: [], expirationsByCacheKind: new Map() },
    undefined,
    undefined,
    undefined,
  );
  return workAsyncStorage.run({ route: '/test' } as WorkStore, () =>
    workUnitAsyncStorage.run(store, run),
  );
}

async function accountCookie(userId: string) {
  const now = Math.floor(Date.now() / 1000);
  const token = (type: string) =>
    `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ token_type: type, user_id: userId, iat: now - 1, exp: now + 300 })).toString('base64url')}.test`;
  const built = await buildAuthSessionCookies({
    accessToken: token('access'),
    refreshToken: token('refresh'),
  });
  return built.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

test('browser verification claims never authorize intent creation', async (t) => {
  setup(t);
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('No provider request allowed');
  });
  const req = request({
    ...body,
    djangoOrderIntentVerifyPayload: upstream,
    djangoOrderIntentOrderId: 'ORD-123',
  });
  const response = await inRequest(req, () => intent(req));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'CHECKOUT_EMAIL_VERIFICATION_REQUIRED');
  assert.equal(fetch.mock.callCount(), 0);
});

test('a lost intent response reuses its immutable provider order and rejects changed selections', async (t) => {
  const { proof, proofCookies } = setup(t);
  const row = {
    orderToken: checkoutAttemptToken(body.attemptId, proof),
    userId: null,
    customerEmail: body.customer.email,
    paypalOrderId: 'PAYPAL-EXISTING',
    djangoOrderIntentPayload: {
      requestFingerprint: checkoutInputFingerprint({
        selections: body.selections,
        email: body.customer.email,
        name: body.customer.name,
        address,
        quote,
      }),
    },
  };
  global.__paypalTxLedger__ = {
    paypalIntent: { findUnique: async () => row },
  } as unknown as PrismaClient;
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Must reuse provider order');
  });
  const req = request(body, proofCookies);
  const response = await inRequest(req, () => intent(req));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, {
    orderToken: row.orderToken,
    paypalOrderId: 'PAYPAL-EXISTING',
  });
  assert.match(response.headers.get('set-cookie') ?? '', /HttpOnly/u);
  const changed = request(
    { ...body, selections: [{ ...body.selections[0], quantity: 3 }] },
    proofCookies,
  );
  const rejected = await inRequest(changed, () => intent(changed));
  assert.equal(rejected.status, 409);
  assert.equal((await rejected.json()).code, 'CHECKOUT_ATTEMPT_CHANGED');
  assert.equal(fetch.mock.callCount(), 0);
});

test('the Django proxy issues HttpOnly evidence only from a verified successful upstream response', async (t) => {
  const { proof } = setup(t);
  t.mock.method(globalThis, 'fetch', async () => Response.json(upstream));
  const pending = { ...proof, verified: false, verificationMethod: 'django-otp' as const };
  const pendingCookies = `${CHECKOUT_BROWSER_COOKIE}=${sealCheckoutValue(proof.browserId, 'browser', 60)}; ${emailProofCookieName(proof.intentUuid)}=${sealCheckoutValue(pending, 'email-proof', 60)}`;
  const req = request(
    {
      email: 'customer@example.com',
      otp: '123456',
      order_id: 'ORD-123',
      intentUuid: proof.intentUuid,
    },
    pendingCookies,
    '/next-api/shop/checkout/django-order-intent/verify',
  );
  const response = await inRequest(req, () =>
    handleDjangoOrderIntent(req, '/orders/intent/verify'),
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie') ?? '', /checkout-browser=/u);
  assert.match(response.headers.get('set-cookie') ?? '', /checkout-proof-/u);
  assert.match(response.headers.get('set-cookie') ?? '', /HttpOnly/u);
});

test('an account email proof cannot authorize a payment after logout or another account signs in', async (t) => {
  const { proof } = setup(t);
  const owned = { ...proof, ownerId: 'alice' };
  const proofCookies = `${CHECKOUT_BROWSER_COOKIE}=${sealCheckoutValue(proof.browserId, 'browser', 60)}; ${emailProofCookieName(proof.intentUuid)}=${sealCheckoutValue(owned, 'email-proof', 60)}`;
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('No provider request allowed');
  });
  for (const account of ['', await accountCookie('bob')]) {
    const req = request(body, `${account}; ${proofCookies}`);
    const response = await inRequest(req, () => intent(req));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, 'CHECKOUT_EMAIL_VERIFICATION_REQUIRED');
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('a guest email proof is bound to the signed-in owner when an existing payment attempt is resumed', async (t) => {
  const { proof, proofCookies } = setup(t);
  const row = {
    orderToken: checkoutAttemptToken(body.attemptId, proof),
    userId: 'alice',
    customerEmail: body.customer.email,
    paypalOrderId: 'PAYPAL-EXISTING',
    djangoOrderIntentPayload: {
      requestFingerprint: checkoutInputFingerprint({
        selections: body.selections,
        email: body.customer.email,
        name: body.customer.name,
        address,
        quote,
      }),
    },
  };
  global.__paypalTxLedger__ = {
    paypalIntent: { findUnique: async () => row },
  } as unknown as PrismaClient;
  const req = request(body, `${await accountCookie('alice')}; ${proofCookies}`);
  const response = await inRequest(req, () => intent(req));
  assert.equal(response.status, 200);
  const bound = openCheckoutValue<CheckoutEmailProof>(
    response.cookies.get(emailProofCookieName(proof.intentUuid))?.value,
    'email-proof',
  );
  assert.equal(bound?.ownerId, 'alice');
});

test('only the original payment grant can claim a guest checkout, and another account cannot claim it again', async (t) => {
  setup(t);
  const row = { orderToken: 'guest-order', userId: null as string | null };
  let writes = 0;
  global.__paypalTxLedger__ = {
    paypalIntent: {
      findUnique: async () => ({ ...row }),
      updateMany: async ({
        where,
        data,
      }: {
        where: { userId: string | null };
        data: { userId: string };
      }) => {
        if (row.userId !== where.userId) return { count: 0 };
        writes += 1;
        row.userId = data.userId;
        return { count: 1 };
      },
    },
  } as unknown as PrismaClient;
  const original = `${checkoutGrantCookieName(row.orderToken)}=${createCheckoutGrant(row, 'payment')}`;
  const alice = request(
    { orderToken: row.orderToken },
    `${await accountCookie('alice')}; ${original}`,
    '/next-api/shop/checkout/claim',
  );
  assert.equal((await inRequest(alice, () => claim(alice))).status, 200);
  assert.equal(row.userId, 'alice');
  const bob = request(
    { orderToken: row.orderToken },
    `${await accountCookie('bob')}; ${original}`,
    '/next-api/shop/checkout/claim',
  );
  assert.equal((await inRequest(bob, () => claim(bob))).status, 403);
  assert.equal(writes, 1);
});

test('payment status requires access, remains read-only, and never returns provider error details', async (t) => {
  setup(t);
  const row = {
    orderToken: 'paid-order',
    userId: 'alice',
    status: 'captured',
    capturePayload: {
      id: 'capture-id',
      status: 'COMPLETED',
      amount: { value: '25.00', currencyCode: 'USD' },
    },
    authorizePayload: {},
    canonicalOrderSnapshot: null,
    canonicalOrderSnapshotVersion: null,
    canonicalOrderSnapshotHash: null,
    cartSnapshot: [],
    updatedAt: new Date(),
    processingCompletedAt: null,
    receiptLink: null,
    receiptFile: null,
    lastErrorCode: 'PROVIDER_FAILURE',
    lastErrorMessage: 'PRIVATE_PROVIDER_DIAGNOSTIC',
  };
  global.__paypalTxLedger__ = {
    paypalIntent: { findUnique: async () => row },
  } as unknown as PrismaClient;
  const read = async (cookie = '') => {
    const req = new NextRequest(
      'http://localhost:3000/next-api/paypal/tx-ledger/payments/paid-order/status',
      { headers: { cookie, host: 'localhost:3000' } },
    );
    return inRequest(req, () =>
      status(req, { params: Promise.resolve({ orderToken: row.orderToken }) }),
    );
  };
  assert.equal((await read()).status, 403);
  assert.equal((await read(await accountCookie('bob'))).status, 403);
  const response = await read(await accountCookie('alice'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal((await response.text()).includes('PRIVATE_PROVIDER_DIAGNOSTIC'), false);
});

test('exact-order recovery requires matching checkout email and completed payment evidence', async (t) => {
  setup(t);
  const row = {
    orderToken: 'completed-order',
    customerEmail: 'customer@example.com',
    capturePayload: {
      id: 'capture-id',
      status: 'COMPLETED',
      amount: { value: '25.00', currencyCode: 'USD' },
    },
  };
  global.__paypalTxLedger__ = {
    paypalIntent: { findUnique: async () => row },
  } as unknown as PrismaClient;
  assert.equal(
    (await findEmailRecoveryCheckouts('customer@example.com', row.orderToken)).length,
    1,
  );
  assert.deepEqual(await findEmailRecoveryCheckouts('other@example.com', row.orderToken), []);
  row.capturePayload.status = 'PENDING';
  assert.deepEqual(await findEmailRecoveryCheckouts('customer@example.com', row.orderToken), []);
});

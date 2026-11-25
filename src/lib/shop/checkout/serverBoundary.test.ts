import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import type { PrismaClient as FulfillmentPrismaClient } from '@/lib/prisma/shop/merchizeFulfillmentOps/generated/merchizeFulfillmentOps/client';
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
import { finalizeCanonicalOrderSnapshot } from '@/lib/paypal/orderSnapshot/canonicalize';
import { canonicalReviewItemsHash, CHECKOUT_REVIEW_VERSION } from './checkoutReviewLines';
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
    SHOP_CHECKOUT_PAUSED: 'false',
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

function savedReviewedCheckout(proof: CheckoutEmailProof) {
  const snapshot = finalizeCanonicalOrderSnapshot({
    version: 'shop-alpha-order-v1',
    hashAlgorithm: 'sha256',
    createdAt: '2026-11-21T00:00:00.000Z',
    destination: { countryIso3: 'NGA', region: 'Lagos' },
    currency: 'USD',
    lines: [
      {
        lineId: 'p:v',
        productId: 'p',
        variantId: 'v',
        supplierProductId: 'supplier-p',
        supplierVariantId: 'supplier-v',
        sku: 'SKU',
        sellerSku: null,
        title: 'Verified shirt',
        selectedOptions: [{ name: 'Size', value: 'M' }],
        imageUrl: '/media/shirt.jpg',
        quantity: 2,
        unitAmount: { currency: 'USD', value: '10.00' },
        lineAmount: { currency: 'USD', value: '20.00' },
        shippingAllocation: { currency: 'USD', value: '5.00' },
      },
    ],
    subtotal: { currency: 'USD', value: '20.00' },
    shipping: { currency: 'USD', value: '5.00' },
    total: { currency: 'USD', value: '25.00' },
  });
  const requestFingerprint = checkoutInputFingerprint({
    selections: body.selections,
    email: body.customer.email,
    name: body.customer.name,
    address,
    quote,
  });
  return {
    orderToken: checkoutAttemptToken(body.attemptId, proof),
    userId: null,
    customerEmail: body.customer.email,
    paypalOrderId: 'PAYPAL-EXISTING',
    canonicalOrderSnapshot: snapshot,
    canonicalOrderSnapshotVersion: snapshot.version,
    canonicalOrderSnapshotHash: snapshot.hash,
    djangoOrderIntentPayload: { requestFingerprint },
    djangoOrderIntentVerifyPayload: {
      verified: true,
      review: {
        version: CHECKOUT_REVIEW_VERSION,
        acknowledgedAt: '2026-11-21T00:00:00.000Z',
        requestFingerprint,
        quote,
        itemsHash: canonicalReviewItemsHash(snapshot),
        canonicalSnapshotHash: snapshot.hash,
      },
    },
  };
}

function forbidCheckoutEffects(t: TestContext, row: unknown) {
  let reads = 0;
  let writes = 0;
  const noWrite = async () => {
    writes += 1;
    throw new Error('No ledger write allowed');
  };
  global.__paypalTxLedger__ = {
    paypalIntent: {
      findUnique: async () => {
        reads += 1;
        return row;
      },
      create: noWrite,
      update: noWrite,
      updateMany: noWrite,
    },
  } as unknown as PrismaClient;
  const network = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('No provider request allowed');
  });
  return { reads: () => reads, writes: () => writes, network };
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

test('missing acknowledgement and malformed item review stop before ledger or provider work', async (t) => {
  const { proofCookies } = setup(t);
  const effects = forbidCheckoutEffects(t, null);
  for (const review of [
    undefined,
    { acknowledged: false, quote },
    { acknowledged: true, quote, itemsHash: 'invalid' },
  ]) {
    const req = request({ ...body, review }, proofCookies);
    const response = await inRequest(req, () => intent(req));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'CHECKOUT_REVIEW_REQUIRED');
  }
  assert.equal(effects.reads(), 0);
  assert.equal(effects.writes(), 0);
  assert.equal(effects.network.mock.callCount(), 0);
});

test('a new checkout without the trusted item review cannot create a ledger or PayPal order', async (t) => {
  const { proofCookies } = setup(t);
  const effects = forbidCheckoutEffects(t, null);
  const req = request(body, proofCookies);
  const response = await inRequest(req, () => intent(req));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'CHECKOUT_REVIEW_REQUIRED');
  assert.equal(effects.reads(), 1);
  assert.equal(effects.writes(), 0);
  assert.equal(effects.network.mock.callCount(), 0);
});

test('paused checkout blocks new PayPal orders without blocking reuse of the exact existing order', async (t) => {
  const { proof, proofCookies } = setup(t);
  process.env.SHOP_CHECKOUT_PAUSED = 'true';
  const row = savedReviewedCheckout(proof);
  const payload = {
    ...body,
    review: { ...body.review, itemsHash: row.djangoOrderIntentVerifyPayload.review.itemsHash },
  };
  for (const existing of [null, { ...row, paypalOrderId: null, status: 'error' }, row]) {
    const effects = forbidCheckoutEffects(t, existing);
    const req = request(payload, proofCookies);
    const result = await inRequest(req, () => intent(req));
    const json = await result.json();
    if (existing?.paypalOrderId) {
      assert.equal(result.status, 200);
      assert.equal(json.data.paypalOrderId, row.paypalOrderId);
    } else {
      assert.equal(result.status, 503);
      assert.equal(json.code, 'CHECKOUT_PAUSED');
      assert.equal(result.headers.get('cache-control'), 'private, no-store');
    }
    assert.equal(effects.writes(), 0);
    assert.equal(effects.network.mock.callCount(), 0);
  }
});

test('rejects an unsupported payment source before touching the ledger or provider', async (t) => {
  const { proofCookies } = setup(t);
  const effects = forbidCheckoutEffects(t, null);
  const req = request({ ...body, paymentSource: 'venmo' }, proofCookies);
  const response = await inRequest(req, () => intent(req));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'INVALID_PAYMENT_SOURCE');
  assert.equal(effects.reads(), 0);
  assert.equal(effects.writes(), 0);
  assert.equal(effects.network.mock.callCount(), 0);
});

test('an attempt cannot reuse an order created for a different payment source', async (t) => {
  const { proof, proofCookies } = setup(t);
  for (const paymentSource of [undefined, 'paypal'] as const) {
    const row = savedReviewedCheckout(proof);
    const effects = forbidCheckoutEffects(t, {
      ...row,
      djangoOrderIntentPayload: { ...row.djangoOrderIntentPayload, paymentSource },
    });
    const req = request(
      {
        ...body,
        paymentSource: paymentSource === 'paypal' ? undefined : 'paypal',
        review: { ...body.review, itemsHash: row.djangoOrderIntentVerifyPayload.review.itemsHash },
      },
      proofCookies,
    );
    const response = await inRequest(req, () => intent(req));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'CHECKOUT_ATTEMPT_CHANGED');
    assert.equal(effects.writes(), 0);
    assert.equal(effects.network.mock.callCount(), 0);
  }
});

test('a same-price item mismatch blocks both provider-order reuse and unfinished retry writes', async (t) => {
  const { proof, proofCookies } = setup(t);
  for (const paypalOrderId of ['PAYPAL-EXISTING', null]) {
    const row = {
      ...savedReviewedCheckout(proof),
      paypalOrderId,
      status: 'error',
      updatedAt: new Date(0),
    };
    const effects = forbidCheckoutEffects(t, row);
    const req = request(
      { ...body, review: { ...body.review, itemsHash: '0'.repeat(64) } },
      proofCookies,
    );
    const response = await inRequest(req, () => intent(req));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'CHECKOUT_REVIEW_CHANGED');
    assert.equal(effects.writes(), 0);
    assert.equal(effects.network.mock.callCount(), 0);
  }
});

test('v2 retries require the saved item review and reuse the exact existing order without side effects', async (t) => {
  const { proof, proofCookies } = setup(t);
  const row = savedReviewedCheckout(proof);
  const effects = forbidCheckoutEffects(t, row);
  const missing = request(body, proofCookies);
  const blocked = await inRequest(missing, () => intent(missing));
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).code, 'CHECKOUT_REVIEW_REQUIRED');
  const req = request(
    {
      ...body,
      review: { ...body.review, itemsHash: row.djangoOrderIntentVerifyPayload.review.itemsHash },
    },
    proofCookies,
  );
  const response = await inRequest(req, () => intent(req));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.paypalOrderId, row.paypalOrderId);
  assert.equal(effects.writes(), 0);
  assert.equal(effects.network.mock.callCount(), 0);
});

test('canonical purchases without saved acknowledgement cannot bypass review on an intent retry', async (t) => {
  const { proof, proofCookies } = setup(t);
  const row = { ...savedReviewedCheckout(proof), djangoOrderIntentVerifyPayload: null };
  const effects = forbidCheckoutEffects(t, row);
  const req = request(body, proofCookies);
  const response = await inRequest(req, () => intent(req));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, 'CHECKOUT_REVIEW_REQUIRED');
  assert.equal(effects.writes(), 0);
  assert.equal(effects.network.mock.callCount(), 0);
});

test('a complete v1 acknowledgement preserves its bound purchase without a new item hash', async (t) => {
  const { proof, proofCookies } = setup(t);
  const row = savedReviewedCheckout(proof);
  const { itemsHash, canonicalSnapshotHash, ...review } = row.djangoOrderIntentVerifyPayload.review;
  assert.ok(itemsHash && canonicalSnapshotHash);
  const effects = forbidCheckoutEffects(t, {
    ...row,
    djangoOrderIntentVerifyPayload: {
      verified: true,
      review: { ...review, version: 'checkout-review-v1' },
    },
  });
  const req = request(body, proofCookies);
  const response = await inRequest(req, () => intent(req));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.paypalOrderId, row.paypalOrderId);
  assert.equal(effects.writes(), 0);
  assert.equal(effects.network.mock.callCount(), 0);
});

test('a lost intent response reuses its immutable provider order and rejects changed selections', async (t) => {
  const { proof, proofCookies } = setup(t);
  const row = {
    orderToken: checkoutAttemptToken(body.attemptId, proof),
    userId: null,
    customerEmail: body.customer.email,
    paypalOrderId: 'PAYPAL-EXISTING',
    canonicalOrderSnapshot: null,
    canonicalOrderSnapshotVersion: null,
    canonicalOrderSnapshotHash: null,
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
    canonicalOrderSnapshot: null,
    canonicalOrderSnapshotVersion: null,
    canonicalOrderSnapshotHash: null,
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
    lastEventType: 'PRIVATE_PROVIDER_EVENT',
    djangoPaymentSaveCustomId: 'PRIVATE_PAYMENT_SAVE_ID',
    customerEmail: 'PRIVATE_CONTACT@example.test',
    shippingSnapshot: { shipping_address_line_1: 'PRIVATE_STREET' },
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
  const body = await response.json();
  assert.equal(JSON.stringify(body).includes('PRIVATE_'), false);
  assert.equal('lastEventType' in body, false);
  assert.equal('djangoPaymentSaveCustomId' in body, false);
  assert.equal('code' in body.error, false);
  assert.equal(body.paymentSaved, true);
  assert.equal(body.paymentProgressed, true);
  assert.equal(body.receiptReady, false);
  assert.equal(body.paidAmountLabel, '$25.00');
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

test('status without completed capture does not tell the customer their payment was received', async (t) => {
  const { proof } = setup(t);
  const row = {
    ...savedReviewedCheckout(proof),
    userId: 'alice',
    status: 'captured',
    authorizePayload: null,
    capturePayload: null,
    updatedAt: new Date(),
  };
  let writes = 0;
  global.__paypalTxLedger__ = {
    paypalIntent: {
      findUnique: async () => row,
      updateMany: async () => {
        writes += 1;
        return { count: 0 };
      },
    },
  } as unknown as PrismaClient;
  const network = t.mock.method(globalThis, 'fetch', async () => assert.fail('No network call'));
  const req = new NextRequest(
    `http://localhost:3000/next-api/paypal/tx-ledger/payments/${row.orderToken}/status`,
    { headers: { cookie: await accountCookie('alice'), host: 'localhost:3000' } },
  );
  const response = await inRequest(req, () =>
    status(req, { params: Promise.resolve({ orderToken: row.orderToken }) }),
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.paidAmountLabel, null);
  assert.match(body.error.message, /payment details need review/u);
  assert.doesNotMatch(body.error.message, /payment (?:was )?received/u);
  assert.equal(writes, 0);
  assert.equal(network.mock.callCount(), 0);
});

test('confirmation exposes only verified saved fulfillment milestones after checkout access', async (t) => {
  const { proof } = setup(t);
  const row = {
    ...savedReviewedCheckout(proof),
    userId: null as string | null,
    status: 'completed',
    djangoPaymentSaveCustomId: 'PRIVATE_PAYMENT_SAVE',
    merchizeFulfillmentResponsePayload: {
      status: 201,
      success: true,
      data: {
        processing_status: 'completed',
        error_message: 'Order created but details not available',
      },
    },
    authorizePayload: { amount: { value: '25.00', currencyCode: 'USD' } },
    capturePayload: {
      id: 'PRIVATE_CAPTURE',
      status: 'COMPLETED',
      amount: { value: '25.00', currencyCode: 'USD' },
    },
    updatedAt: new Date(),
    processingCompletedAt: new Date() as Date | null,
    fulfillmentAddressOverriddenAt: null as Date | null,
    lastErrorCode: null as string | null,
  };
  const effects = forbidCheckoutEffects(t, row);
  for (const [key, value] of Object.entries({
    SHOP_OPS_DATA_TARGET: 'dev',
    MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_DEV_STRING: 'postgres://local.invalid/fulfillment',
    PAYPAL_TX_LEDGER_NEON_POOLED_DB_DEV_STRING: 'postgres://local.invalid/payments',
  })) {
    const old = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (old === undefined) delete process.env[key];
      else process.env[key] = old;
    });
  }
  const progress = {
    code: 'PRIVATE_ORDER_CODE',
    external_number: 'PRIVATE_EXTERNAL_NUMBER',
    identifier: 'PRIVATE_IDENTIFIER',
    order_progress: [
      { event: 'order_imported', status: 'done' },
      { event: 'fulfillment_cost_paid', status: 'done' },
      { event: 'in_production', status: 'done' },
      { event: 'shipment_started', status: 'pending' },
    ],
    package_progresses: [{ tracking_number: 'PRIVATE_TRACKING' }],
  };
  const fulfillment = {
    orderToken: row.orderToken,
    djangoPaymentSaveCustomId: row.djangoPaymentSaveCustomId,
    merchizeExternalOrderNumber: progress.external_number,
    merchizeIdentifier: progress.identifier,
    merchizeOrderCode: progress.code,
    pushVerifiedAt: new Date() as Date | null,
    duplicateDetectedAt: null,
    productionGateStatus: 'push_verified',
    addressReviewStatus: 'ready',
    lastReadinessCheckAt: null as Date | null,
    lastProgressSyncAt: new Date('2026-11-22T12:05:00.000Z'),
    heldAt: null as Date | null,
    lastLookupAt: null as Date | null,
    merchizeProductionReadinessPayload: { status: 'ready', addressReadbackStatus: 'matched' },
    merchizeProgressPayload: { success: true, data: [progress] },
    merchizeTrackingPayload: {
      success: true,
      data: [
        { _id: 'PRIVATE_PACKAGE_1', external_number: progress.external_number, shipment_status: 'delivered' },
        { _id: 'PRIVATE_PACKAGE_2', external_number: progress.external_number, shipment_status: 'in_transit' },
      ],
    },
    deliveryStatus: null as string | null,
  };
  const findMany = t.mock.fn<(query: unknown) => Promise<(typeof fulfillment)[]>>(async () => [
    fulfillment,
  ]);
  const previous = global.__merchizeFulfillmentOpsPrisma__;
  global.__merchizeFulfillmentOpsPrisma__ = {
    merchizeFulfillmentOrder: { findMany },
  } as unknown as FulfillmentPrismaClient;
  t.after(() => {
    global.__merchizeFulfillmentOpsPrisma__ = previous;
  });

  const grant = `${checkoutGrantCookieName(row.orderToken)}=${createCheckoutGrant(row, 'status')}`;
  const read = async (cookie = grant) => {
    const req = new NextRequest(
      `http://localhost:3001/next-api/paypal/tx-ledger/payments/${row.orderToken}/status`,
      { headers: { cookie } },
    );
    return inRequest(req, () =>
      status(req, { params: Promise.resolve({ orderToken: row.orderToken }) }),
    );
  };
  assert.equal((await read('')).status, 403);
  assert.equal(findMany.mock.callCount(), 0);

  const response = await read();
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const payload = await response.json();
  assert.equal(payload.postPurchaseStage, 'production_started');
  assert.equal(payload.fulfillmentCheckedAt, '2026-11-22T12:05:00.000Z');
  assert.doesNotMatch(JSON.stringify(payload), /PRIVATE_|package_progresses|order_progress|tracking/i);
  assert.deepEqual(findMany.mock.calls[0]?.arguments[0], {
    where: {
      OR: [{ orderToken: row.orderToken, djangoPaymentSaveCustomId: row.djangoPaymentSaveCustomId }],
    },
    select: {
      orderToken: true,
      djangoPaymentSaveCustomId: true,
      merchizeExternalOrderNumber: true,
      merchizeIdentifier: true,
      merchizeOrderCode: true,
      merchizeProgressPayload: true,
      merchizeTrackingPayload: true,
      deliveryStatus: true,
      lastProgressSyncAt: true,
      pushVerifiedAt: true,
      duplicateDetectedAt: true,
      productionGateStatus: true,
      addressReviewStatus: true,
      lastReadinessCheckAt: true,
      merchizeProductionReadinessPayload: true,
      heldAt: true,
      lastLookupAt: true,
    },
    take: 3,
  });

  findMany.mock.mockImplementationOnce(async () => [
    { ...fulfillment, djangoPaymentSaveCustomId: 'OTHER_PAYMENT' },
  ]);
  assert.equal((await (await read()).json()).postPurchaseStage, null);

  progress.order_progress[3]!.status = 'done';
  assert.equal((await (await read()).json()).postPurchaseStage, 'shipped');
  fulfillment.heldAt = new Date('2026-11-22T12:06:00.000Z');
  fulfillment.lastLookupAt = new Date('2026-11-22T12:07:00.000Z');
  const held = await (await read()).json();
  assert.equal(held.fulfillmentOnHold, true);
  assert.equal(held.postPurchaseStage, 'shipped');
  assert.equal(held.fulfillmentCheckedAt, '2026-11-22T12:07:00.000Z');
  assert.equal((await read('')).status, 403);
  fulfillment.heldAt = null;
  const resumed = await (await read()).json();
  assert.equal(resumed.fulfillmentOnHold, false);
  assert.equal(resumed.postPurchaseStage, 'shipped');
  progress.order_progress.push({ event: 'delivered', status: 'done' });
  fulfillment.deliveryStatus = 'delivered_verified';
  assert.equal((await (await read()).json()).postPurchaseStage, 'shipped');
  fulfillment.merchizeTrackingPayload.data[1]!.shipment_status = 'delivered';
  const delivered = await (await read()).json();
  assert.equal(delivered.postPurchaseStage, 'delivered');
  assert.doesNotMatch(JSON.stringify(delivered), /PRIVATE_|tracking/i);
  progress.order_progress.pop();
  progress.order_progress[3]!.status = 'pending';

  const production = progress.order_progress[2]!;
  production.status = 'pending';
  assert.equal((await (await read()).json()).postPurchaseStage, 'sent_for_preparation');
  production.status = 'done';
  fulfillment.merchizeProgressPayload.data = [{ ...progress, identifier: 'OTHER_STORE' }];
  assert.equal((await (await read()).json()).postPurchaseStage, 'sent_for_preparation');
  fulfillment.merchizeProgressPayload.data = [progress, progress];
  assert.equal((await (await read()).json()).postPurchaseStage, 'sent_for_preparation');
  fulfillment.merchizeProgressPayload.data = [progress];
  findMany.mock.mockImplementationOnce(async () => [fulfillment, fulfillment]);
  assert.equal((await (await read()).json()).postPurchaseStage, null);
  findMany.mock.mockImplementationOnce(async () => [
    { ...fulfillment, pushVerifiedAt: null },
  ]);
  assert.equal((await (await read()).json()).postPurchaseStage, null);
  findMany.mock.mockImplementationOnce(async () => []);
  assert.equal((await (await read()).json()).postPurchaseStage, null);
  findMany.mock.mockImplementationOnce(async () => {
    throw new Error('PRIVATE_DATABASE_FAILURE');
  });
  assert.equal((await (await read()).json()).postPurchaseStage, null);

  row.status = 'payment_saved';
  row.processingCompletedAt = null;
  row.lastErrorCode = 'MERCHIZE_ADDRESS_VALIDATION_PENDING';
  fulfillment.pushVerifiedAt = null;
  fulfillment.productionGateStatus = 'ready';
  fulfillment.lastReadinessCheckAt = new Date('2026-11-22T12:00:00.000Z');
  const refreshed = await (await read()).json();
  assert.equal(refreshed.postPurchaseStage, 'awaiting_preparation');
  assert.equal(refreshed.fulfillmentCheckedAt, '2026-11-22T12:00:00.000Z');
  assert.doesNotMatch(refreshed.recoveryReason, /checking your delivery address/i);
  row.fulfillmentAddressOverriddenAt = new Date('2026-11-22T12:01:00.000Z');
  const changed = await (await read()).json();
  assert.equal(changed.postPurchaseStage, 'checking_delivery_details');
  assert.equal(changed.fulfillmentCheckedAt, null);
  row.userId = 'alice';
  assert.equal((await read(await accountCookie('bob'))).status, 403);

  row.status = 'refunded';
  const calls = findMany.mock.callCount();
  assert.equal((await (await read(await accountCookie('alice'))).json()).postPurchaseStage, null);
  assert.equal(findMany.mock.callCount(), calls);
  assert.equal(effects.network.mock.callCount(), 0);
  assert.equal(effects.writes(), 0);
});

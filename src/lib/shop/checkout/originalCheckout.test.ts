import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { createRequestStoreForAPI } from 'next/dist/server/async-storage/request-store';
import {
  workAsyncStorage,
  type WorkStore,
} from 'next/dist/server/app-render/work-async-storage.external';
import { workUnitAsyncStorage } from 'next/dist/server/app-render/work-unit-async-storage.external';
import type { PrismaClient } from '@/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client';
import { finalizeCanonicalOrderSnapshot } from '@/lib/paypal/orderSnapshot/canonicalize';
import { buildAuthSessionCookies } from '@/lib/session/session-cookies';
import { GET as resume } from '@/app/api/shop/checkout/[orderToken]/resume/route';
import { checkoutAddressHash, checkoutGrantCookieName, createCheckoutGrant } from './checkoutProof';
import { toOriginalCheckout, type OriginalCheckoutRow } from './originalCheckoutServer';
import { CheckoutRequestError } from './serverRequest';

function originalCheckoutRow(): OriginalCheckoutRow {
  const snapshot = finalizeCanonicalOrderSnapshot({
    version: 'shop-alpha-order-v1',
    hashAlgorithm: 'sha256',
    createdAt: '2026-10-27T00:00:00.000Z',
    destination: { countryIso3: 'USA', region: 'California' },
    currency: 'USD',
    lines: [
      {
        lineId: 'product:variant',
        productId: 'product',
        variantId: 'variant',
        supplierProductId: 'private-supplier-product',
        supplierVariantId: 'private-supplier-variant',
        sku: 'PRIVATE-SKU',
        sellerSku: null,
        title: 'Original shirt',
        selectedOptions: [{ name: 'Size', value: 'M' }],
        imageUrl: 'https://d2dytk4tvgwhb4.cloudfront.net/store/front.jpg',
        quantity: 2,
        unitAmount: { currency: 'USD', value: '15.00' },
        lineAmount: { currency: 'USD', value: '30.00' },
        shippingAllocation: { currency: 'USD', value: '5.00' },
      },
    ],
    subtotal: { currency: 'USD', value: '30.00' },
    shipping: { currency: 'USD', value: '5.00' },
    total: { currency: 'USD', value: '35.00' },
  });
  const address = {
    shipping_address_line_1: '12 Main Road',
    shipping_address_line_2: '',
    shipping_city: 'Los Angeles',
    shipping_state: 'California',
    shipping_country: 'USA',
    zip_code: '90001',
  };
  return {
    orderToken: 'original-order',
    userId: null,
    paypalOrderId: 'PAYPAL-ORIGINAL',
    paypalAuthorizationId: null,
    djangoOrderIntentUuid: 'django-intent',
    djangoOrderIntentOrderId: 'ORD-ORIGINAL',
    djangoOrderIntentPayload: {
      proof: {
        verified: true,
        intentUuid: 'django-intent',
        orderId: 'ORD-ORIGINAL',
        email: 'customer@example.com',
        addressHash: checkoutAddressHash(address),
      },
    },
    customerName: 'Original Customer',
    customerEmail: 'customer@example.com',
    countryIso2: 'US',
    countryIso3: 'USA',
    shippingSnapshot: address,
    canonicalOrderSnapshot: JSON.parse(JSON.stringify(snapshot)),
    canonicalOrderSnapshotVersion: snapshot.version,
    canonicalOrderSnapshotHash: snapshot.hash,
    status: 'intent_created',
    authorizePayload: null,
    capturePayload: null,
    lastEventType: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    receiptLink: null,
    receiptFile: null,
    djangoPaymentSaveCustomId: null,
    djangoPaymentSaveResponsePayload: null,
    merchizeFulfillmentRequestPayload: null,
    merchizeFulfillmentResponsePayload: null,
    merchizeFulfillmentProcessingId: null,
    merchizeProviderOrderId: null,
    merchizeProviderOrderCode: null,
    fulfillmentAddressOverride: null,
    fulfillmentAddressOverrideReason: null,
    fulfillmentAddressOverriddenBy: null,
    fulfillmentAddressOverriddenAt: null,
    retryCount: 0,
    processingTriggerSource: null,
    processingTriggerDetail: null,
    processingTriggeredAt: null,
    processingCompletedAt: null,
    postProcessingLockId: null,
    postProcessingLockedAt: null,
    postProcessingLockExpiresAt: null,
  };
}

const rejectsResume = (row: OriginalCheckoutRow) =>
  assert.throws(
    () => toOriginalCheckout(row),
    (error) =>
      error instanceof CheckoutRequestError &&
      error.status === 409 &&
      error.code === 'ORIGINAL_CHECKOUT_REVIEW_REQUIRED',
  );

test('original checkout exposes its sealed purchase without mutable cart or provider internals', () => {
  const result = toOriginalCheckout(originalCheckoutRow());
  assert.equal(result.orderToken, 'original-order');
  assert.equal(result.paypalOrderId, 'PAYPAL-ORIGINAL');
  assert.equal(result.countryCode, 'US');
  assert.deepEqual(result.quote, { currency: 'USD', subtotal: 30, shipping: 5, total: 35 });
  assert.equal(result.lines[0].quantity, 2);
  assert.equal(result.lines[0].unitAmount, '15.00');
  assert.equal(result.lines[0].options, 'Size: M');
  assert.doesNotMatch(
    JSON.stringify(result),
    /private-supplier|PRIVATE-SKU|authorizePayload|django-intent|userId|addressHash/,
  );
});

test('any progressed or uncertain payment evidence blocks original checkout resumption', () => {
  for (const status of [
    'intent_creating',
    'authorized',
    'captured',
    'pending',
    'error',
    'completed',
    'refunded',
  ])
    rejectsResume({ ...originalCheckoutRow(), status });
  for (const changed of [
    { paypalOrderId: null },
    { paypalAuthorizationId: 'authorization' },
    { authorizePayload: {} },
    { capturePayload: {} },
    { lastEventType: 'CHECKOUT.ORDER.APPROVED' },
    { lastErrorCode: 'UNCERTAIN' },
    { lastErrorMessage: 'secret diagnostic' },
    { receiptLink: 'https://receipt.invalid' },
    { receiptFile: 'receipt.pdf' },
    { djangoPaymentSaveCustomId: 'payment-save' },
    { djangoPaymentSaveResponsePayload: {} },
    { merchizeFulfillmentRequestPayload: {} },
    { merchizeFulfillmentResponsePayload: {} },
    { merchizeFulfillmentProcessingId: 'processing' },
    { merchizeProviderOrderId: 'provider-order' },
    { merchizeProviderOrderCode: 'provider-code' },
    { fulfillmentAddressOverride: {} },
    { retryCount: 1 },
    { processingTriggerSource: 'admin' },
    { processingTriggeredAt: new Date() },
    { processingCompletedAt: new Date() },
    { postProcessingLockId: 'lock' },
    { postProcessingLockedAt: new Date() },
    { postProcessingLockExpiresAt: new Date(0) },
  ])
    rejectsResume({ ...originalCheckoutRow(), ...changed });
});

test('legacy, incomplete, corrupted and missing-proof checkouts fail closed', () => {
  for (const changed of [
    {
      canonicalOrderSnapshot: null,
      canonicalOrderSnapshotVersion: null,
      canonicalOrderSnapshotHash: null,
    },
    { canonicalOrderSnapshot: null },
    { canonicalOrderSnapshot: { title: 'altered' } },
    { canonicalOrderSnapshotHash: 'a'.repeat(64) },
    { djangoOrderIntentPayload: null },
    { djangoOrderIntentUuid: null },
    { djangoOrderIntentOrderId: null },
    { djangoOrderIntentUuid: 'other-intent' },
    { djangoOrderIntentOrderId: 'other-order' },
    { customerEmail: 'other@example.com' },
    { shippingSnapshot: { broken: true } },
  ])
    rejectsResume({ ...originalCheckoutRow(), ...changed });
});

test('saved destination must match canonical country, region and the verified original address', () => {
  const row = originalCheckoutRow();
  const shipping = row.shippingSnapshot as Record<string, string>;
  for (const change of [
    { shipping_country: 'CAN' },
    { shipping_state: 'New York' },
    { shipping_address_line_1: '99 Changed Road' },
    { shipping_city: 'Changed City' },
    { zip_code: '99999' },
    { shipping_address_line_2: 'Apartment 2' },
  ])
    rejectsResume({ ...row, shippingSnapshot: { ...shipping, ...change } });
  rejectsResume({ ...row, countryIso2: 'CA' });
  rejectsResume({ ...row, countryIso3: 'CAN' });
  assert.equal(
    toOriginalCheckout({
      ...row,
      shippingSnapshot: { ...shipping, shipping_country: 'United States' },
    }).countryCode,
    'US',
  );
});

test('review identity is stable and binds the saved customer, address, provider order and sealed basket', () => {
  const row = originalCheckoutRow();
  const original = toOriginalCheckout(row);
  assert.equal(toOriginalCheckout({ ...row }).reviewKey, original.reviewKey);
  for (const changed of [
    { customerName: 'Another name' },
    { paypalOrderId: 'PAYPAL-OTHER' },
    { orderToken: 'another-order' },
  ])
    assert.notEqual(toOriginalCheckout({ ...row, ...changed }).reviewKey, original.reviewKey);
});

test('unsafe image links are omitted and unsafe numeric quotes cannot be resumed', () => {
  const row = originalCheckoutRow();
  const { hash, ...draft } = JSON.parse(JSON.stringify(row.canonicalOrderSnapshot));
  assert.equal(hash, row.canonicalOrderSnapshotHash);
  const withImage = finalizeCanonicalOrderSnapshot({
    ...draft,
    lines: draft.lines.map((line: Record<string, unknown>) => ({
      ...line,
      imageUrl: 'javascript:alert(1)',
    })),
  });
  assert.equal(
    toOriginalCheckout({
      ...row,
      canonicalOrderSnapshot: JSON.parse(JSON.stringify(withImage)),
      canonicalOrderSnapshotHash: withImage.hash,
    }).lines[0].image,
    null,
  );
  const huge = finalizeCanonicalOrderSnapshot({
    ...draft,
    lines: draft.lines.map((line: Record<string, unknown>) => ({
      ...line,
      quantity: 1,
      unitAmount: { currency: 'USD', value: '90071992547410.00' },
      lineAmount: { currency: 'USD', value: '90071992547410.00' },
    })),
    subtotal: { currency: 'USD', value: '90071992547410.00' },
    total: { currency: 'USD', value: '90071992547415.00' },
  });
  rejectsResume({
    ...row,
    canonicalOrderSnapshot: JSON.parse(JSON.stringify(huge)),
    canonicalOrderSnapshotHash: huge.hash,
  });
});

function inRequest(cookie: string, orderToken = 'original-order') {
  const req = new NextRequest(`http://localhost:3000/next-api/shop/checkout/${orderToken}/resume`, {
    headers: { cookie },
  });
  const store = createRequestStoreForAPI(
    req,
    req.nextUrl,
    { tags: [], expirationsByCacheKind: new Map() },
    undefined,
    undefined,
    undefined,
  );
  return workAsyncStorage.run({ route: '/test' } as WorkStore, () =>
    workUnitAsyncStorage.run(store, () => resume(req, { params: Promise.resolve({ orderToken }) })),
  );
}

async function accountCookie(userId: string) {
  const now = Math.floor(Date.now() / 1000);
  const token = (kind: string) =>
    `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ token_type: kind, user_id: userId, iat: now - 1, exp: now + 300 })).toString('base64url')}.test`;
  const result = await buildAuthSessionCookies({
    accessToken: token('access'),
    refreshToken: token('refresh'),
  });
  return result.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

test('resume requires payment ownership and never claims, creates, reprices or calls a provider', async (t) => {
  const previousClient = global.__paypalTxLedger__;
  const previousSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'original-checkout-test-secret-of-at-least-32-bytes';
  t.after(() => {
    global.__paypalTxLedger__ = previousClient;
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
  });
  const network = t.mock.method(globalThis, 'fetch', async () => assert.fail('No provider call'));
  let row = originalCheckoutRow();
  global.__paypalTxLedger__ = {
    paypalIntent: {
      findUnique: async ({ where }: { where: { orderToken: string } }) =>
        where.orderToken === row.orderToken ? row : null,
      updateMany: async () => assert.fail('GET must not claim or mutate the order'),
      create: async () => assert.fail('GET must not create another order'),
    },
  } as unknown as PrismaClient;
  const grant = (mode: 'payment' | 'status') =>
    `${checkoutGrantCookieName(row.orderToken)}=${createCheckoutGrant(row, mode)}`;
  assert.equal((await inRequest('')).status, 403);
  assert.equal((await inRequest(grant('status'))).status, 403);
  for (const cookie of [
    grant('payment'),
    `${grant('payment')}; ${await accountCookie('owner-a')}`,
  ]) {
    const result = await inRequest(cookie);
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('cache-control'), 'private, no-store');
    assert.equal(result.headers.get('set-cookie'), null);
    assert.equal((await result.json()).checkout.paypalOrderId, 'PAYPAL-ORIGINAL');
    assert.equal(row.userId, null, 'A signed-in guest reader must not silently claim ownership');
  }
  row = { ...row, userId: 'owner-a' };
  assert.equal((await inRequest(await accountCookie('owner-a'))).status, 200);
  assert.equal((await inRequest(await accountCookie('owner-b'))).status, 403);
  assert.equal((await inRequest(await accountCookie('owner-a'), 'missing-order')).status, 404);
  row = { ...row, capturePayload: { status: 'COMPLETED' } };
  const unsafe = await inRequest(await accountCookie('owner-a'));
  assert.equal(unsafe.status, 409);
  assert.equal((await unsafe.json()).code, 'ORIGINAL_CHECKOUT_REVIEW_REQUIRED');
  assert.equal(network.mock.callCount(), 0);
});

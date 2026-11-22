import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { OrdersController, PaymentsController } from '@paypal/paypal-server-sdk';
import { NextRequest } from 'next/server';
import { createRequestStoreForAPI } from 'next/dist/server/async-storage/request-store';
import {
  workAsyncStorage,
  type WorkStore,
} from 'next/dist/server/app-render/work-async-storage.external';
import { workUnitAsyncStorage } from 'next/dist/server/app-render/work-unit-async-storage.external';
import { POST as capture } from '@/app/api/paypal/orders/capture/route';
import { POST as authorize } from '@/app/api/paypal/orders/authorize/route';
import { finalizeCanonicalOrderSnapshot } from '@/lib/paypal/orderSnapshot/canonicalize';
import { checkoutGrantCookieName, createCheckoutGrant } from '@/lib/shop/checkout/checkoutProof';
import type { PrismaClient } from '@/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client';
import { canonicalReviewItemsHash } from '@/lib/shop/checkout/checkoutReviewLines';

function preserveTestState(t: TestContext) {
  const previousClient = global.__paypalTxLedger__;
  const previousSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'address-review-boundary-test-secret-at-least-32-bytes';
  t.after(() => {
    global.__paypalTxLedger__ = previousClient;
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
  });
}

function canonicalIntent() {
  const snapshot = finalizeCanonicalOrderSnapshot({
    version: 'shop-alpha-order-v1',
    hashAlgorithm: 'sha256',
    createdAt: '2026-11-21T00:00:00.000Z',
    destination: { countryIso3: 'USA', region: 'CA' },
    currency: 'USD',
    lines: [
      {
        lineId: 'product:variant',
        productId: 'product',
        variantId: 'variant',
        supplierProductId: 'supplier-product',
        supplierVariantId: 'supplier-variant',
        sku: 'SKU',
        sellerSku: null,
        title: 'Example shirt',
        selectedOptions: [],
        imageUrl: 'https://example.test/shirt.jpg',
        quantity: 1,
        unitAmount: { currency: 'USD', value: '20.00' },
        lineAmount: { currency: 'USD', value: '20.00' },
        shippingAllocation: { currency: 'USD', value: '5.00' },
      },
    ],
    subtotal: { currency: 'USD', value: '20.00' },
    shipping: { currency: 'USD', value: '5.00' },
    total: { currency: 'USD', value: '25.00' },
  });
  return {
    orderToken: 'example-order',
    userId: null,
    paypalOrderId: 'example-provider-order',
    paypalAuthorizationId: 'example-authorization',
    status: 'authorized',
    canonicalOrderSnapshot: snapshot,
    canonicalOrderSnapshotVersion: snapshot.version,
    canonicalOrderSnapshotHash: snapshot.hash,
    capturePayload: null,
    djangoOrderIntentVerifyPayload: null as unknown,
    updatedAt: new Date(),
    shippingSnapshot: {
      shipping_address_line_1: '12 Example Street',
      shipping_city: 'Example City',
      shipping_state: 'CA',
      zip_code: '90001',
      shipping_country: 'USA',
    },
    authorizePayload: {
      purchaseUnits: [
        {
          shipping: {
            address: {
              addressLine1: '12 Example Street',
              adminArea2: 'Example City',
              adminArea1: 'CA',
              postalCode: '90001',
              countryCode: 'US',
            },
          },
          payments: { authorizations: [{ amount: { value: '25.00', currencyCode: 'USD' } }] },
        },
      ],
    },
  };
}

async function runRoute(
  row: Pick<ReturnType<typeof canonicalIntent>, 'orderToken' | 'userId' | 'paypalOrderId'> & {
    paypalAuthorizationId: string | null;
  },
  stage: 'authorize' | 'capture',
) {
  const req = new NextRequest(`http://localhost:3001/next-api/paypal/orders/${stage}`, {
    method: 'POST',
    headers: {
      host: 'localhost:3001',
      origin: 'http://localhost:3001',
      'content-type': 'application/json',
      cookie: `${checkoutGrantCookieName(row.orderToken)}=${createCheckoutGrant(row, 'payment')}`,
    },
    body: JSON.stringify({
      orderToken: row.orderToken,
      ...(stage === 'authorize'
        ? { orderID: row.paypalOrderId }
        : { authorizationId: row.paypalAuthorizationId }),
    }),
  });
  const requestStore = createRequestStoreForAPI(
    req,
    req.nextUrl,
    { tags: [], expirationsByCacheKind: new Map() },
    undefined,
    undefined,
    undefined,
  );
  return workAsyncStorage.run({ route: '/test' } as WorkStore, () =>
    workUnitAsyncStorage.run(requestStore, () =>
      stage === 'authorize' ? authorize(req) : capture(req),
    ),
  );
}

test('the capture route stops a changed PayPal address before any provider capture', async (t) => {
  preserveTestState(t);
  const row = canonicalIntent();
  row.authorizePayload.purchaseUnits[0].shipping.address.addressLine1 = '99 Changed Street';
  global.__paypalTxLedger__ = {
    paypalIntent: {
      findUnique: async () => row,
      // Model a concurrent write; no database or notification work is needed for this assertion.
      updateMany: async () => ({ count: 0 }),
    },
  } as unknown as PrismaClient;
  const provider = t.mock.method(
    PaymentsController.prototype,
    'captureAuthorizedPayment',
    async () => assert.fail('A changed address must never dispatch capture'),
  );
  const network = t.mock.method(globalThis, 'fetch', async () =>
    assert.fail('No network call allowed'),
  );
  const response = await runRoute(row, 'capture');
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, 'PAYPAL_REVIEW_ADDRESS_CHANGED');
  assert.equal(provider.mock.callCount(), 0);
  assert.equal(network.mock.callCount(), 0);
});

for (const stage of ['authorize', 'capture'] as const) {
  for (const reviewCase of ['missing', 'malformed', 'changed'] as const) {
    test(`${stage} stops a ${reviewCase} saved review before any payment call`, async (t) => {
      preserveTestState(t);
      const row = canonicalIntent();
      row.djangoOrderIntentVerifyPayload =
        reviewCase === 'missing'
          ? null
          : {
              verified: true,
              review:
                reviewCase === 'malformed'
                  ? { version: 'checkout-review-v2' }
                  : {
                      version: 'checkout-review-v2',
                      acknowledgedAt: '2026-11-21T00:00:00.000Z',
                      canonicalSnapshotHash: '0'.repeat(64),
                      itemsHash: canonicalReviewItemsHash(row.canonicalOrderSnapshot),
                      requestFingerprint: 'a'.repeat(64),
                      quote: { currency: 'USD', subtotal: 20, shipping: 5, total: 25 },
                    },
            };
      const intent =
        stage === 'authorize'
          ? {
              ...row,
              status: 'intent_created',
              paypalAuthorizationId: null,
              authorizePayload: null,
            }
          : row;
      let reads = 0;
      let writes = 0;
      global.__paypalTxLedger__ = {
        paypalIntent: {
          findUnique: async () => {
            reads += 1;
            return intent;
          },
          updateMany: async () => {
            writes += 1;
            assert.fail('A rejected saved review must not write to the ledger');
          },
        },
      } as unknown as PrismaClient;
      const authorization = t.mock.method(OrdersController.prototype, 'authorizeOrder', async () =>
        assert.fail('A rejected saved review must not dispatch authorization'),
      );
      const payment = t.mock.method(
        PaymentsController.prototype,
        'captureAuthorizedPayment',
        async () => assert.fail('A rejected saved review must not dispatch capture'),
      );
      const lookup = t.mock.method(OrdersController.prototype, 'getOrder', async () =>
        assert.fail('A fresh unpaid review must not dispatch a provider lookup'),
      );
      const network = t.mock.method(globalThis, 'fetch', async () =>
        assert.fail('No network call allowed'),
      );
      const response = await runRoute(intent, stage);
      assert.equal(response.status, 409);
      assert.equal(
        (await response.json()).code,
        reviewCase === 'changed' ? 'CHECKOUT_REVIEW_CHANGED' : 'CHECKOUT_REVIEW_REQUIRED',
      );
      assert.equal(reads, 1);
      assert.equal(writes, 0);
      assert.equal(authorization.mock.callCount(), 0);
      assert.equal(payment.mock.callCount(), 0);
      assert.equal(lookup.mock.callCount(), 0);
      assert.equal(network.mock.callCount(), 0);
    });
  }
}

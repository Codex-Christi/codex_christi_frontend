import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { finalizeCanonicalOrderSnapshot } from '@/lib/paypal/orderSnapshot/canonicalize';
import type { Prisma } from '@/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client';
import type { AuthSessionState } from '@/lib/auth/session-snapshot';
import { accountViewState } from '@/lib/auth/account-view-state';
import { readCustomerFulfillmentMilestones } from '@/lib/shop/checkout/readCustomerFulfillmentMilestone';
import {
  createAccountOrderReader,
  AccountHistoryAccessError,
  InvalidHistoryQueryError,
} from './reader';
import {
  toHistoryOrder,
  historyImageUrl,
  historyMoney,
  HISTORY_PAGE_SIZE,
  type HistoryListLedgerRow,
} from './model';
import { receiptObjectKey } from './receiptReference';

function row(index = 1, owner = 'owner-a'): HistoryListLedgerRow {
  const snapshot = finalizeCanonicalOrderSnapshot({
    version: 'shop-alpha-order-v1',
    hashAlgorithm: 'sha256',
    createdAt: '2026-10-01T00:00:00.000Z',
    destination: { countryIso3: 'USA', region: null },
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
        title: 'Purchased shirt',
        selectedOptions: [{ name: 'Size', value: 'M' }],
        imageUrl: 'https://d2dytk4tvgwhb4.cloudfront.net/store/front.jpg',
        quantity: 1,
        unitAmount: { currency: 'USD', value: '30.00' },
        lineAmount: { currency: 'USD', value: '30.00' },
        shippingAllocation: { currency: 'USD', value: '5.00' },
      },
    ],
    subtotal: { currency: 'USD', value: '30.00' },
    shipping: { currency: 'USD', value: '5.00' },
    total: { currency: 'USD', value: '35.00' },
  });
  return {
    id: `id-${String(index).padStart(3, '0')}`,
    orderToken: `token-${index}`,
    userId: owner,
    djangoOrderIntentOrderId: `ORD-${index}`,
    djangoPaymentSaveCustomId: null,
    merchizeFulfillmentResponsePayload: null,
    fulfillmentAddressOverriddenAt: null,
    lastErrorCode: null,
    processingCompletedAt: null,
    status: 'completed',
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    receiptLink: 'https://payment-receipts.codexchristi.shop/paypal/invoice.pdf',
    receiptFile: 'invoice',
    canonicalOrderSnapshot: snapshot as unknown as Prisma.JsonValue,
    canonicalOrderSnapshotHash: snapshot.hash,
    canonicalOrderSnapshotVersion: snapshot.version,
    shippingSnapshot: null,
    authorizePayload: { amount: { value: '35.00', currencyCode: 'USD' } },
    capturePayload: {
      id: 'capture-1',
      status: 'COMPLETED',
      amount: { value: '35.00', currencyCode: 'USD' },
    },
  };
}

const session = (): AuthSessionState => ({
  isAuthenticated: true,
  user_id: 'owner-a',
  expiresAt: Date.now() + 60_000,
});

test('history uses sealed purchased details and never treats post-processing completion as delivery', () => {
  const order = toHistoryOrder(row());
  assert.equal(order.status, 'Order confirmed');
  assert.equal(order.needsReview, false);
  assert.equal(order.paidAmount, '$35.00');
  assert.equal(order.lines[0].title, 'Purchased shirt');
  assert.equal(order.lines[0].options, 'Size: M');
  assert.equal(order.expectedAmount, '$35.00');
  assert.doesNotMatch(
    JSON.stringify(order),
    /authorizePayload|capturePayload|userId|receiptLink|supplier-product/,
  );
});

test('actual capture discrepancies remain visible without changing the expected order total', () => {
  const value = row();
  value.status = 'error';
  value.capturePayload = {
    id: 'capture',
    status: 'COMPLETED',
    amount: { value: '0.01', currencyCode: 'USD' },
  };
  const order = toHistoryOrder(value);
  assert.equal(order.paidAmount, '$0.01');
  assert.equal(order.expectedAmount, '$35.00');
  assert.equal(order.status, 'Needs review');
});

test('legacy, malformed, missing and refunded purchases are retained without fabricated details', () => {
  for (const canonicalOrderSnapshot of [null, { invalid: true }]) {
    const order = toHistoryOrder({ ...row(), canonicalOrderSnapshot });
    assert.equal(order.detailsAvailable, false);
    assert.deepEqual(order.lines, []);
    assert.equal(order.paidAmount, '$35.00');
  }
  const noCapture = toHistoryOrder({ ...row(), capturePayload: null });
  assert.equal(noCapture.paidAmount, null);
  assert.equal(noCapture.needsReview, true);
  assert.equal(toHistoryOrder({ ...row(), status: 'refunded' }).status, 'Refund recorded');
  assert.equal(toHistoryOrder({ ...row(), status: 'fulfillment_failed' }).status, 'Needs review');
});

test('saved asset links are allowlisted and historical money preserves zero-digit currencies', () => {
  for (const url of [
    'javascript:alert(1)',
    'https://other.example/paypal/invoice.pdf',
    'https://payment-receipts.codexchristi.shop.evil.example/paypal/a',
    'https://user@payment-receipts.codexchristi.shop/paypal/a',
  ])
    assert.equal(receiptObjectKey({ orderToken: 'token-1', receiptLink: url }), null);
  assert.equal(historyImageUrl('https://unknown.example/image.png'), null);
  assert.equal(historyImageUrl('/media/img/product.jpg'), '/media/img/product.jpg');
  assert.equal(historyImageUrl('/media/../api/private'), null);
  assert.equal(historyMoney('2900', 'JPY'), '¥2,900');
  assert.equal(historyMoney('NaN', 'USD'), null);
  assert.equal(historyMoney('-5', 'USD'), null);
});

test('list, detail and receipt reject anonymous or expired sessions before touching storage', async () => {
  for (const auth of [
    { isAuthenticated: false, user_id: null },
    { ...session(), expiresAt: 1 },
  ]) {
    const reader = createAccountOrderReader({
      session: async () => auth,
      list: async () => assert.fail('No unauthenticated database access'),
      detail: async () => assert.fail('No unauthenticated database access'),
      milestones: async () => assert.fail('No unauthenticated fulfillment access'),
      fulfillment: async () => assert.fail('No unauthenticated shipment access'),
    });
    await assert.rejects(reader.list(), AccountHistoryAccessError);
    await assert.rejects(reader.detail('token-1'), AccountHistoryAccessError);
    await assert.rejects(reader.receipt('token-1'), AccountHistoryAccessError);
  }
});

test('pagination stays owner-scoped and bounded, including equal timestamps and a forged cursor', async () => {
  let queries: Parameters<Parameters<typeof createAccountOrderReader>[0]['list']>[0][] = [];
  const values = Array.from({ length: HISTORY_PAGE_SIZE + 1 }, (_, i) => row(100 - i));
  const reader = createAccountOrderReader({
    session: async () => session(),
    list: async (query) => {
      queries.push(query);
      return values;
    },
    detail: async () => null,
    milestones: async () => assert.fail('No fulfillment lookup without a matched handoff'),
    fulfillment: async () => assert.fail('Listing must not create per-order queries'),
  });
  const first = await reader.list();
  assert.equal(first.orders.length, HISTORY_PAGE_SIZE);
  assert.ok(first.nextCursor);
  assert.equal(queries[0].take, 21);
  assert.equal(queries[0].where.userId, 'owner-a');
  assert.deepEqual(queries[0].orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
  const predicate = JSON.stringify(queries[0].where);
  assert.match(predicate, /COMPLETED/);
  assert.match(predicate, /purchaseUnits/);
  assert.match(predicate, /purchase_units/);
  assert.doesNotMatch(
    predicate,
    /isCustomerProtectionVisible|customerEmail|intent_created|authorized/,
  );
  await reader.list({ cursor: first.nextCursor });
  assert.match(JSON.stringify(queries[1].where), /id-081/);
  const forged = Buffer.from(
    JSON.stringify({ date: '2026-11-01T00:00:00.000Z', id: 'other-owner-id' }),
  ).toString('base64url');
  await reader.list({ cursor: forged, filter: 'refunds' });
  assert.equal(queries[2].where.userId, 'owner-a');
  assert.match(JSON.stringify(queries[2].where), /refunded/);
  queries = [];
  await assert.rejects(reader.list({ cursor: 'invalid' }), InvalidHistoryQueryError);
  await assert.rejects(reader.list({ filter: ['all'] }), InvalidHistoryQueryError);
  assert.equal(queries.length, 0);
});

test('foreign or unowned rows never grant account history or receipt access', async () => {
  let auth = session();
  let shipmentReads = 0;
  let foreign: HistoryListLedgerRow = { ...row(), userId: null };
  const reader = createAccountOrderReader({
    session: async () => auth,
    list: async () => [foreign],
    detail: async (query) => {
      assert.equal(query.where.userId, auth.user_id);
      assert.equal(query.where.orderToken, 'token-1');
      return foreign;
    },
    milestones: async () => assert.fail('No fulfillment lookup for a foreign buyer'),
    fulfillment: async () => {
      shipmentReads++;
      return [];
    },
  });
  for (const owner of [null, 'owner-b']) {
    foreign = { ...row(), userId: owner };
    assert.equal(await reader.detail('token-1'), null);
    assert.equal(await reader.receipt('token-1'), null);
    await assert.rejects(reader.list(), AccountHistoryAccessError);
  }
  assert.equal(shipmentReads, 0);
  auth = { ...session(), user_id: 'owner-b' };
  assert.equal((await reader.detail('token-1'))?.order.reference, 'ORD-1');
});

test('missing or failed shipment enrichment does not hide a paid purchase', async () => {
  let fail = false;
  const reader = createAccountOrderReader({
    session: async () => session(),
    list: async () => [],
    detail: async () => row(),
    milestones: async () => new Map(),
    fulfillment: async (tokens) => {
      assert.deepEqual(tokens, ['token-1']);
      if (fail) throw Error('offline');
      return [];
    },
  });
  assert.equal((await reader.detail('token-1'))?.unavailable, false);
  fail = true;
  assert.equal((await reader.detail('token-1'))?.order.paidAmount, '$35.00');
  assert.equal((await reader.detail('token-1'))?.unavailable, true);
  assert.equal((await reader.receipt('token-1'))?.receiptLink, row().receiptLink);
});

test("an account switch or logout cannot keep another owner's history visible", () => {
  const initial = session();
  for (const state of [
    { status: 'anonymous', accountOwnerId: null, expiresAt: null },
    { status: 'authenticated', accountOwnerId: 'owner-b', expiresAt: Date.now() + 60_000 },
    { status: 'unavailable', accountOwnerId: 'owner-a', expiresAt: 1 },
  ] as const) {
    const view = accountViewState(state, initial);
    assert.equal(view.visible && view.ownerId === initial.user_id, false);
  }
});

test('shipment enrichment cannot leak another order or imply shared tracking freshness', async () => {
  const reader = createAccountOrderReader({
    session: async () => session(),
    list: async () => [],
    detail: async () => row(),
    milestones: async () => new Map(),
    fulfillment: async () =>
      ['token-1', 'someone-else'].map((orderToken) => ({
        orderToken,
        reference: orderToken,
        progress: 'done',
        tracking: 'pending',
        progressCheckedAt: '2026-10-27T00:00:00.000Z',
        trackingCheckedAt: '2026-09-01T00:00:00.000Z',
      })),
  });
  const result = await reader.detail('token-1');
  assert.equal(result?.updates.length, 1);
  assert.equal(result?.updates[0].trackingCheckedAt, '2026-09-01T00:00:00.000Z');
  assert.equal(result?.updates[0].progressCheckedAt, '2026-10-27T00:00:00.000Z');
  assert.equal(result?.order.status, 'Order confirmed');
});

test('history runtime has no checkout mutations, supplier calls, polling, cron or after hooks', async () => {
  for (const file of ['reader.ts', 'server.ts']) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.doesNotMatch(
      source,
      /\.\s*(create|update|upsert|delete|updateMany)\s*\(|\bfetch\s*\(|\bafter\s*\(|setInterval|claimCurrentCheckout|consumePurchase|runPaidFulfillmentProcessing/,
    );
  }
});

test('order rows show the same saved milestones as confirmation with one matched lookup per page', async (t) => {
  const previousOps = global.__merchizeFulfillmentOpsPrisma__;
  const previousEnv = { ...process.env };
  Object.assign(process.env, {
    SHOP_OPS_DATA_TARGET: 'dev',
    PAYPAL_TX_LEDGER_NEON_POOLED_DB_DEV_STRING: 'postgresql://fixture:fixture@localhost:1/unused',
    MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_DEV_STRING:
      'postgresql://fixture:fixture@localhost:1/unused',
  });
  t.after(() => {
    global.__merchizeFulfillmentOpsPrisma__ = previousOps;
    for (const key of Object.keys(process.env)) if (!(key in previousEnv)) delete process.env[key];
    Object.assign(process.env, previousEnv);
  });
  let providerCalls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    providerCalls++;
    return new Response(null, { status: 503 });
  });
  const checkedAt = new Date('2026-10-02T00:00:00Z');
  const ledger = (index: number): HistoryListLedgerRow => ({
    ...row(index),
    djangoPaymentSaveCustomId: `save-${index}`,
    merchizeFulfillmentResponsePayload: {
      status: 201, success: true, data: { processing_status: 'completed' },
    },
  });
  const saved = (index: number, events: string[] = [], packageStates: string[] = []) => ({
    orderToken: `token-${index}`,
    djangoPaymentSaveCustomId: `save-${index}`,
    merchizeExternalOrderNumber: `ORD-${index}`,
    merchizeIdentifier: null,
    merchizeOrderCode: null,
    merchizeProgressPayload: {
      success: true,
      data: [{
        external_number: `ORD-${index}`,
        order_progress: events.map((event) => ({ event, status: 'done' })),
      }],
    },
    merchizeTrackingPayload: {
      success: true,
      data: [{
        external_number: `ORD-${index}`,
        packages: packageStates.map((shipment_status, n) => ({
          _id: `pack-${n}`, shipment_status, tracking_number: 'PRIVATE-TRACKING',
        })),
      }],
    },
    deliveryStatus: packageStates.length === 2 ? 'delivered_verified' : null,
    lastProgressSyncAt: checkedAt,
    pushVerifiedAt: checkedAt,
    duplicateDetectedAt: null,
    productionGateStatus: 'push_verified',
    addressReviewStatus: 'ready',
    lastReadinessCheckAt: checkedAt,
    merchizeProductionReadinessPayload: {
      addressReadbackStatus: 'matched', providerPushState: 'pending',
    },
    heldAt: null as Date | null,
    lastLookupAt: checkedAt,
  });
  const releasePending = {
    ...saved(1), pushVerifiedAt: null, productionGateStatus: 'ready',
  };
  const savedRows = [
    saved(5, ['delivered', 'shipment_started'], ['delivered', 'delivered']),
    releasePending,
    { ...saved(2), heldAt: checkedAt },
    saved(3, ['in_production'], ['pre_transit']),
    saved(4, ['delivered', 'shipment_started'], ['delivered', 'in_transit']),
    { ...saved(6, ['shipment_started']), djangoPaymentSaveCustomId: 'mismatched' },
    saved(7, ['shipment_started']), saved(7, ['shipment_started']),
    saved(50, ['shipment_started']),
  ];
  let dbReads = 0;
  let offline = false;
  global.__merchizeFulfillmentOpsPrisma__ = {
    merchizeFulfillmentOrder: {
      findMany: async (query: { where: unknown; take: number }) => {
        dbReads++;
        assert.deepEqual(query.where, {
          OR: Array.from({ length: 7 }, (_, i) => ({
            orderToken: `token-${i + 1}`, djangoPaymentSaveCustomId: `save-${i + 1}`,
          })),
        });
        assert.equal(query.take, 15);
        if (offline) throw Error('Unavailable');
        return savedRows;
      },
    },
  } as unknown as NonNullable<typeof global.__merchizeFulfillmentOpsPrisma__>;
  const reader = createAccountOrderReader({
    session: async () => session(),
    list: async () => [
      { ...ledger(1), status: 'payment_saved', lastErrorCode: 'MERCHIZE_PUSH_VERIFICATION_PENDING' },
      ...[2, 3, 4, 5, 6, 7].map(ledger),
      { ...ledger(8), status: 'refunded' },
      { ...ledger(9), capturePayload: null },
      { ...ledger(10), merchizeFulfillmentResponsePayload: { success: false } },
      ...Array.from({ length: HISTORY_PAGE_SIZE - 10 }, (_, i) => row(11 + i)),
      ledger(70),
    ],
    detail: async () => null,
    milestones: readCustomerFulfillmentMilestones,
    fulfillment: async () => assert.fail('The list must not read individual package details'),
  });
  const { orders, nextCursor } = await reader.list();
  assert.equal(dbReads, 1);
  assert.equal(orders.length, HISTORY_PAGE_SIZE);
  assert.ok(nextCursor);
  assert.deepEqual(orders.slice(0, 10).map((order) => order.status), [
    'Order received', 'Order on hold', 'Production started', 'Shipment started', 'Order delivered',
    'Order confirmed', 'Order confirmed', 'Refund recorded', 'Needs review', 'Order confirmed',
  ]);
  assert.doesNotMatch(JSON.stringify(orders), /save-\d|PRIVATE-TRACKING|providerPushState/u);
  offline = true;
  const fallback = await reader.list();
  assert.equal(fallback.orders[0].status, 'Order received');
  assert.equal(fallback.orders[4].status, 'Order confirmed');
  assert.equal(dbReads, 2);
  assert.equal(providerCalls, 0);
});

test('paid dates and legacy item names come only from historical payment evidence', () => {
  const value = row();
  value.capturePayload = {
    ...(value.capturePayload as object),
    create_time: '2026-10-02T03:04:05Z',
  };
  assert.equal(toHistoryOrder(value).displayDate, '2026-10-02T03:04:05.000Z');
  assert.equal(toHistoryOrder(value).dateLabel, 'Paid');
  const legacy = {
    ...value,
    canonicalOrderSnapshot: null,
    canonicalOrderSnapshotVersion: null,
    canonicalOrderSnapshotHash: null,
    authorizePayload: {
      purchaseUnits: [
        {
          items: [
            {
              name: 'Original paid item',
              quantity: '2',
              unitAmount: { value: '15.00', currencyCode: 'USD' },
            },
          ],
        },
      ],
    },
  };
  assert.equal(toHistoryOrder(legacy).lines[0].title, 'Original paid item');
  assert.equal(toHistoryOrder(legacy).detailsSource, 'payment_record');
  assert.equal(
    toHistoryOrder({ ...legacy, canonicalOrderSnapshotHash: 'damaged' }).lines.length,
    0,
    'Corrupt canonical data must not gain a legacy fallback',
  );
  const pending = { ...legacy, capturePayload: { status: 'PENDING' } };
  assert.equal(toHistoryOrder(pending).lines.length, 0);
  assert.equal(toHistoryOrder(pending).dateLabel, 'Checkout started');
});

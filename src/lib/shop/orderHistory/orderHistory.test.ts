import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { finalizeCanonicalOrderSnapshot } from '@/lib/paypal/orderSnapshot/canonicalize';
import type { Prisma } from '@/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client';
import type { AuthSessionState } from '@/lib/auth/session-snapshot';
import { accountViewState } from '@/lib/auth/account-view-state';
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
  type HistoryLedgerRow,
} from './model';
import { receiptObjectKey } from './receiptReference';

function row(index = 1, owner = 'owner-a'): HistoryLedgerRow {
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
    status: 'completed',
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    receiptLink: 'https://payment-receipts.codexchristi.shop/paypal/invoice.pdf',
    receiptFile: 'invoice',
    canonicalOrderSnapshot: snapshot as unknown as Prisma.JsonValue,
    canonicalOrderSnapshotHash: snapshot.hash,
    canonicalOrderSnapshotVersion: snapshot.version,
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
  let foreign: HistoryLedgerRow = { ...row(), userId: null };
  const reader = createAccountOrderReader({
    session: async () => auth,
    list: async () => [foreign],
    detail: async (query) => {
      assert.equal(query.where.userId, auth.user_id);
      assert.equal(query.where.orderToken, 'token-1');
      return foreign;
    },
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

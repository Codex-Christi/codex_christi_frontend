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
import { POST } from '@/app/api/shop/checkout/[orderToken]/request-recovery/route';
import { createCheckoutGrant, checkoutGrantCookieName } from './checkoutProof';
import { getCustomerRecoveryRequestState } from './customerRecoveryRequestServer';
import { findPayPalRecoveryCandidates } from '@/lib/paypal/txLedger/recoveryScanner';

function paidOrder(now: Date) {
  const amount = { value: '40.00', currencyCode: 'USD' };
  return {
    orderToken: 'fixture-paid-order',
    userId: null,
    status: 'captured',
    createdAt: new Date(now.getTime() - 120_000),
    updatedAt: new Date(now.getTime() - 60_000),
    canonicalOrderSnapshot: null,
    canonicalOrderSnapshotVersion: null,
    canonicalOrderSnapshotHash: null,
    authorizePayload: { purchaseUnits: [{ amount }] },
    capturePayload: { id: 'fixture-capture', status: 'COMPLETED', amount },
    processingCompletedAt: null as Date | null,
    postProcessingLockExpiresAt: null as Date | null,
    customerRecoveryRequestedAt: null as Date | null,
    lastErrorCode: null as string | null,
    merchizeFulfillmentResponsePayload: null as unknown,
  };
}

test('only stalled, verified paid checkpoints can queue; progress, blocks, and completion stay distinct', () => {
  const now = new Date();
  const row = paidOrder(now);
  const evaluate = (patch: Partial<typeof row>, available = true) =>
    getCustomerRecoveryRequestState(
      { ...row, ...patch },
      { now, scannerAvailable: () => available },
    );
  assert.equal(evaluate({}), 'available');
  assert.equal(evaluate({ updatedAt: now }), null);
  assert.equal(evaluate({}, false), 'unavailable');
  const lease = new Date(now.getTime() + 10_000);
  assert.equal(evaluate({ postProcessingLockExpiresAt: lease }), null);
  const requested = { customerRecoveryRequestedAt: now };
  assert.equal(evaluate(requested), 'queued');
  assert.equal(evaluate({ ...requested, postProcessingLockExpiresAt: lease }), 'processing');
  assert.equal(evaluate({ ...requested, status: 'completed' }), 'completed');
  assert.equal(evaluate({ ...requested, status: 'refunded' }), null);
  assert.equal(
    evaluate({ ...requested, status: 'fulfillment_attention_required' }),
    'review_required',
  );
  assert.equal(
    evaluate({ ...requested, lastErrorCode: 'DJANGO_FULFILLMENT_REVIEW_REQUIRED' }),
    'review_required',
  );
  assert.equal(evaluate({ lastErrorCode: 'DJANGO_PAYMENT_SAVE_REVIEW_REQUIRED' }), null);
  assert.equal(evaluate({ capturePayload: { ...row.capturePayload, status: 'PENDING' } }), null);
  assert.equal(evaluate(requested, false), 'unavailable');
});

function setup(t: TestContext) {
  const previous = global.__paypalTxLedger__;
  t.after(() => {
    global.__paypalTxLedger__ = previous;
  });
  for (const [key, value] of Object.entries({
    NODE_ENV: 'development',
    SESSION_SECRET: 'customer-recovery-test-secret-of-at-least-32-bytes',
    SHOP_OPS_DATA_TARGET: 'dev',
    SHOP_CHECKOUT_PAUSED: 'true',
    PAYPAL_TX_LEDGER_NEON_POOLED_DB_DEV_STRING: 'postgresql://fixture:fixture@localhost:1/unused',
    MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_DEV_STRING:
      'postgresql://fixture:fixture@localhost:1/unused',
    PAYPAL_TX_LEDGER_RECOVERY_SCANNER_ENABLED: 'true',
    PAYPAL_TX_LEDGER_RECOVERY_SCANNER_SECRET: 'fixture-job',
    PAYPAL_TX_LEDGER_RECOVERY_SCANNER_MIN_AGE_MINUTES: '15',
    PAYPAL_TX_LEDGER_RECOVERY_SCANNER_BATCH_SIZE: '5',
  })) {
    const before = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (before === undefined) delete process.env[key];
      else process.env[key] = before;
    });
  }
  const now = new Date();
  const row = paidOrder(now);
  const network = t.mock.method(globalThis, 'fetch', () =>
    assert.fail('Request must not call a provider'),
  );
  let writes = 0;
  const write = t.mock.fn(
    async ({
      data,
      where,
    }: {
      data: { customerRecoveryRequestedAt: Date; updatedAt: Date };
      where: Record<string, unknown>;
    }) => {
      assert.equal(where.orderToken, row.orderToken);
      assert.equal(where.userId, row.userId);
      assert.equal(where.status, 'captured');
      assert.equal(where.customerRecoveryRequestedAt, null);
      assert.equal(where.processingCompletedAt, null);
      assert.deepEqual(where.updatedAt, row.updatedAt);
      assert.deepEqual(Object.keys(data).sort(), ['customerRecoveryRequestedAt', 'updatedAt']);
      assert.deepEqual(data.updatedAt, row.updatedAt);
      if (row.customerRecoveryRequestedAt) return { count: 0 };
      row.customerRecoveryRequestedAt = data.customerRecoveryRequestedAt;
      writes++;
      return { count: 1 };
    },
  );
  global.__paypalTxLedger__ = {
    paypalIntent: {
      findUnique: async () => structuredClone(row),
      findMany: async ({ where }: { where: { updatedAt: { lte: Date } } }) =>
        row.updatedAt <= where.updatedAt.lte ? [structuredClone(row)] : [],
      updateMany: write,
    },
  } as unknown as PrismaClient;
  const verified = `${checkoutGrantCookieName(row.orderToken)}=${createCheckoutGrant(row, 'status')}`;
  const send = (cookie: string, origin = 'http://localhost:3001', body = '{}') => {
    const req = new NextRequest(
      `http://localhost:3001/next-api/shop/checkout/${row.orderToken}/request-recovery`,
      {
        method: 'POST',
        headers: { cookie, origin, host: 'localhost:3001', 'content-type': 'application/json' },
        body,
      },
    );
    const store = createRequestStoreForAPI(
      req,
      req.nextUrl,
      { tags: [], expirationsByCacheKind: new Map() },
      undefined,
      undefined,
      undefined,
    );
    return workAsyncStorage.run({ route: '/test' } as WorkStore, () =>
      workUnitAsyncStorage.run(store, () =>
        POST(req, { params: Promise.resolve({ orderToken: row.orderToken }) }),
      ),
    );
  };
  return { row, now, network, write, writes: () => writes, verified, send };
}

test('only a verified order can request once, even with concurrent submissions', async (t) => {
  const fixture = setup(t);
  assert.equal((await fixture.send('')).status, 403);
  assert.equal((await fixture.send(fixture.verified, 'https://another.example')).status, 403);
  assert.equal((await fixture.send(fixture.verified, undefined, '{"push":true}')).status, 400);
  assert.equal(fixture.write.mock.callCount(), 0);

  const requests = await Promise.all([
    fixture.send(fixture.verified),
    fixture.send(fixture.verified),
  ]);
  assert.deepEqual(requests.map(({ status }) => status).sort(), [200, 202]);
  for (const response of requests) {
    assert.deepEqual(await response.json(), { state: 'queued' });
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('set-cookie'), null);
  }
  assert.equal(fixture.writes(), 1);
  const before = fixture.row.customerRecoveryRequestedAt;
  assert.equal((await fixture.send(fixture.verified)).status, 200);
  assert.equal(fixture.row.customerRecoveryRequestedAt, before);
  assert.equal(fixture.writes(), 1);
  assert.equal(fixture.network.mock.callCount(), 0);
  assert.deepEqual(await findPayPalRecoveryCandidates({ minAgeMinutes: 15, now: fixture.now }), []);
  const candidates = await findPayPalRecoveryCandidates({
    minAgeMinutes: 15,
    now: new Date(+fixture.now + 14 * 60_000),
  });
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].customerRecoveryRequested, true);
});

test('a disabled or unsafe scanner cannot accept new requests', async (t) => {
  const fixture = setup(t);
  process.env.PAYPAL_TX_LEDGER_RECOVERY_SCANNER_ENABLED = 'false';
  assert.equal((await fixture.send(fixture.verified)).status, 503);
  process.env.PAYPAL_TX_LEDGER_RECOVERY_SCANNER_ENABLED = 'true';
  process.env.PAYPAL_TX_LEDGER_RECOVERY_SCANNER_SECRET = '';
  assert.equal((await fixture.send(fixture.verified)).status, 503);
  process.env.PAYPAL_TX_LEDGER_RECOVERY_SCANNER_SECRET = 'fixture-job';
  fixture.row.status = 'completed';
  assert.equal((await fixture.send(fixture.verified)).status, 409);
  fixture.row.status = 'payment_saved';
  fixture.row.lastErrorCode = 'DJANGO_FULFILLMENT_REVIEW_REQUIRED';
  assert.equal((await fixture.send(fixture.verified)).status, 409);
  fixture.row.lastErrorCode = null;
  fixture.row.merchizeFulfillmentResponsePayload = {
    status: 201,
    success: true,
    data: {
      processing_status: 'completed',
      error_message: 'Order created but details not available',
      response_data: { data: { order_id: 'ORD-FIXTURE' } },
    },
  };
  assert.equal((await fixture.send(fixture.verified)).status, 409);
  assert.equal(fixture.write.mock.callCount(), 0);
  assert.equal(fixture.network.mock.callCount(), 0);
});

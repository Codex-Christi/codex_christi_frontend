import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyMerchizePushVerificationEvidence, verifyMerchizeFulfillmentPush } from './verifyMerchizeFulfillmentPush';

test('requires independent provider evidence after push acknowledgement', () => {
  assert.deepEqual(
    classifyMerchizePushVerificationEvidence(
      { success: true, data: { push_to_fulfillment_progress: 'validating' } },
      { success: true, data: { pushed: false, is_failed: false } },
      { success: true, data: [] },
    ),
    { state: 'pending', progress: 'validating' },
  );
});

test('does not verify a push from the body of an unsuccessful provider read', () => {
  assert.equal(classifyMerchizePushVerificationEvidence(
    { success: false, data: { push_to_fulfillment_progress: 'pushed' } },
    { success: false, data: { is_pushed: true } },
    { success: true, data: [] },
  ).state, 'pending');
});

test('accepts either documented provider pushed flag during retry verification', () => {
  assert.deepEqual(
    classifyMerchizePushVerificationEvidence(
      { success: true, data: { push_to_fulfillment_progress: 'validating' } },
      { success: true, data: { is_pushed: true, is_failed: false } },
      { success: true, data: [] },
    ),
    { state: 'verified', progress: 'validating' },
  );
});

test('recognizes provider failure history instead of retrying another push', () => {
  assert.deepEqual(
    classifyMerchizePushVerificationEvidence(
      { success: true, data: { push_to_fulfillment_progress: 'validating' } },
      { success: true, data: { pushed: false, is_failed: false } },
      {
        success: true,
        data: [{ event: 'manual_push_fulfillment_failed' }],
      },
    ),
    { state: 'failed', progress: 'validating' },
  );
});

test('push verification saves only internal progress and does not refresh customer evidence', async (t) => {
  const previousOps = global.__merchizeFulfillmentOpsPrisma__;
  const previousLedger = global.__paypalTxLedger__;
  const env = {
    SHOP_OPS_DATA_TARGET: 'dev',
    PAYPAL_TX_LEDGER_NEON_BRANCH: 'dev',
    MERCHIZE_FULFILLMENT_OPS_NEON_BRANCH: 'dev',
    PAYPAL_TX_LEDGER_NEON_POOLED_DB_DEV_STRING: 'postgresql://fixture:fixture@localhost:1/unused',
    MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_DEV_STRING: 'postgresql://fixture:fixture@localhost:1/unused',
    MERCHIZE_BO_API_BASE_URL: 'https://merchize.example/bo-api',
    MERCHIZE_API_KEY: 'fixture-key',
  };
  for (const [key, value] of Object.entries(env)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  t.after(() => {
    global.__merchizeFulfillmentOpsPrisma__ = previousOps;
    global.__paypalTxLedger__ = previousLedger;
  });

  const savedAt = new Date('2026-01-01T00:00:00Z');
  const externalProgress = { success: true, data: [{ external_number: 'ORD-fixture' }] };
  const internalProgress = { success: true, data: [{ event: 'production', status: 'done' }] };
  const order = {
    id: 'ops-fixture',
    merchizeOrderId: 'provider-fixture',
    merchizeProgressPayload: externalProgress,
    merchizeInternalProgressPayload: null,
    lastProgressSyncAt: savedAt,
  };
  const db = {
    $transaction: (run: (value: unknown) => Promise<unknown>) => run(db),
    merchizeFulfillmentOrder: {
      findFirst: async () => order,
      update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(order, data),
    },
    merchizeFulfillmentSyncAttempt: {
      create: async () => ({ id: 'attempt-fixture' }),
      update: async () => ({}),
    },
  };
  global.__merchizeFulfillmentOpsPrisma__ = db as unknown as NonNullable<typeof previousOps>;
  global.__paypalTxLedger__ = {
    paypalIntent: { findUnique: async () => null },
    paidOrderRecoveryProjection: { delete: async () => ({}) },
  } as unknown as NonNullable<typeof previousLedger>;

  let rejected = false;
  let newerFailure = false;
  const reads = t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'merchize.example');
    assert.equal(init?.method, 'GET');
    switch (url.pathname) {
      case '/bo-api/order/orders/provider-fixture':
        return Response.json({ success: true, data: rejected ? { push_to_fulfillment_progress: 'failed' } : {} });
      case '/bo-api/order/orders/provider-fixture/send-to-fulfillment-date':
        return Response.json({ success: true, data: { pushed: !rejected, is_failed: false } });
      case '/bo-api/order/orders/provider-fixture/histories':
        return Response.json({ success: true, data: rejected ? [
          {
            event: 'manual_push_fulfillment_failed',
            created: '2026-11-24T17:48:05.000Z',
            description: 'Order is not eligible because order item does not have artwork',
            value: { email: 'private@example.test', user: 'private-actor' },
          },
          ...(newerFailure ? [{
            event: 'manual_push_fulfillment_failed',
            created: '2026-11-24T17:49:05.000Z',
            description: 'A different reason',
          }] : []),
        ] : [] });
      case '/bo-api/order/get-order-progress/provider-fixture':
        return Response.json(internalProgress);
      default:
        assert.fail('Only four mocked provider reads are allowed');
    }
  });
  const result = await verifyMerchizeFulfillmentPush('token-fixture', { retryDelaysMs: [0] });
  assert.equal(result.status, 'verified');
  assert.equal(reads.mock.callCount(), 4);
  assert.strictEqual(order.merchizeProgressPayload, externalProgress);
  assert.strictEqual(order.lastProgressSyncAt, savedAt);
  assert.deepEqual(order.merchizeInternalProgressPayload, internalProgress);

  rejected = true;
  const failure = await verifyMerchizeFulfillmentPush('token-fixture', { retryDelaysMs: [0] });
  assert.equal(failure.status, 'failed');
  if (failure.status !== 'failed') assert.fail('Expected an artwork failure.');
  assert.equal(failure.errorCode, 'MERCHIZE_ARTWORK_MISSING');
  assert.match(failure.errorMessage, /no production artwork/u);
  assert.doesNotMatch(JSON.stringify(failure), /private@example\.test|private-actor/u);

  newerFailure = true;
  const next = await verifyMerchizeFulfillmentPush('token-fixture', { retryDelaysMs: [0] });
  assert.equal(next.status, 'failed');
  if (next.status !== 'failed') assert.fail('Expected generic push failure.');
  assert.equal(next.errorCode, 'MERCHIZE_PUSH_PROVIDER_STATE_FAILED');
});

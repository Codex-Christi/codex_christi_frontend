import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readCustomerFulfillmentHold,
  savedFulfillmentHoldCheck,
} from '@/lib/shop/checkout/readCustomerFulfillmentHold';
import { projectCustomerFulfillmentMilestone } from '@/lib/shop/checkout/readCustomerFulfillmentMilestone';
import { MERCHIZE_FULFILLMENT_CANCELED_CODE, MERCHIZE_ORDER_ON_HOLD } from './status';
import {
  reconcileMerchizeOrderHolds,
  type HoldLookupOrder,
  type HoldReader,
} from './merchizeOrderHold';
import { runMerchizeFulfillmentLifecycleScanner } from './fulfillmentLifecycleScanner';
import { pushMerchizeFulfillmentOrderToProduction } from './pushMerchizeFulfillmentOrderToProduction';

const readyAt = new Date('2026-01-01T00:00:00Z');
const heldAt = new Date('2026-01-01T00:15:00Z');
const resumedAt = new Date('2026-01-01T00:30:00Z');

function order() {
  return {
    id: 'fixture-row',
    merchizeOrderId: 'fixture-provider',
    merchizeExternalOrderNumber: 'ORD-TEST',
    merchizeIdentifier: 'fixture-store',
    heldAt: null as Date | null,
    lastLookupAt: readyAt,
    merchizeOrderCode: 'RX-TEST',
    lastProgressSyncAt: null as Date | null,
    pushVerifiedAt: null as Date | null,
    deliveryStatus: null as string | null,
    duplicateDetectedAt: null,
    productionGateStatus: 'ready',
    addressReviewStatus: 'ready',
    lastReadinessCheckAt: readyAt,
    merchizeProductionReadinessPayload: { status: 'ready', addressReadbackStatus: 'matched' },
    merchizeProgressPayload: null,
  };
}

const detail = {
  _id: 'fixture-provider',
  code: 'RX-TEST',
  external_number: 'ORD-TEST',
  identifier: 'fixture-store',
  order_status: 'on_hold',
};

function reader(current: HoldLookupOrder, rows: unknown[]): HoldReader {
  return {
    read: async (refs) => {
      assert.deepEqual(refs, [{ externalNumber: 'ORD-TEST', identifier: 'fixture-store' }]);
      return { success: true, data: rows };
    },
    save: async (expected, observation) => {
      if (expected.lastLookupAt !== current.lastLookupAt) return false;
      Object.assign(current, observation);
      return true;
    },
  };
}

test('reconciliation saves a provider hold and verifies a resume without changing past milestones', async () => {
  const current = order();
  const [hold] = await reconcileMerchizeOrderHolds(
    [{ ...current }],
    reader(current, [detail]),
    heldAt,
  );
  assert.deepEqual(hold, { id: current.id, state: 'on_hold', saved: true });
  assert.equal(current.heldAt, heldAt);
  assert.equal(savedFulfillmentHoldCheck(current), heldAt);
  assert.equal(savedFulfillmentHoldCheck({ ...current, duplicateDetectedAt: heldAt }), null);
  const [resumed] = await reconcileMerchizeOrderHolds(
    [{ ...current }],
    reader(current, [{ ...detail, order_status: 'unfulfilled' }]),
    resumedAt,
  );
  assert.deepEqual(resumed, { id: current.id, state: 'unfulfilled', saved: true });
  assert.equal(current.heldAt, null);
  assert.equal(current.lastLookupAt, resumedAt);
  assert.equal(current.pushVerifiedAt, null);
  assert.equal(savedFulfillmentHoldCheck(current), null);
});

test('missing, duplicate, wrong-identity, or stale results cannot clear a hold', async () => {
  const current = { ...order(), heldAt, lastLookupAt: heldAt };
  const clear = { ...detail, order_status: 'unfulfilled' };
  for (const rows of [
    [],
    [clear, clear],
    [{ ...clear, _id: 'other' }],
    [{ ...clear, identifier: 'other-store' }],
    [{ ...clear, external_number: 'other' }],
    [{ ...clear, order_status: 'open' }],
    [{ ...clear, order_status: undefined }],
  ]) {
    const [rejected] = await reconcileMerchizeOrderHolds(
      [{ ...current }],
      reader(current, rows),
      resumedAt,
    );
    assert.equal(rejected.saved, false);
    assert.equal(current.heldAt, heldAt);
  }
  const [old] = await reconcileMerchizeOrderHolds(
    [{ ...current }],
    reader(current, [clear]),
    readyAt,
  );
  assert.equal(old.saved, false);
  const [late] = await reconcileMerchizeOrderHolds(
    [{ ...current, lastLookupAt: readyAt }],
    reader(current, [clear]),
    resumedAt,
  );
  assert.equal(late.saved, false);
  assert.equal(current.heldAt, heldAt);
});

test('a verified fulfillment cancellation replaces stale preparation and hold evidence', async () => {
  const current = {
    ...order(),
    heldAt,
    deliveryStatus: null as string | null,
    merchizeTrackingPayload: null,
  };
  const [canceled] = await reconcileMerchizeOrderHolds(
    [{ ...current }],
    reader(current, [{ ...detail, status: 'paid', order_status: 'cancelled_fulfillment' }]),
    resumedAt,
  );

  assert.deepEqual(canceled, { id: current.id, state: 'cancelled', saved: true });
  assert.equal(current.deliveryStatus, 'cancelled');
  assert.equal(current.heldAt, null);
  assert.deepEqual(projectCustomerFulfillmentMilestone(current, null), {
    stage: 'fulfillment_canceled',
    onHold: false,
    checkedAt: resumedAt,
  });
});

test('scheduled hold and resume only read provider detail; a newly held order cannot be pushed', async (t) => {
  const current = {
    ...order(),
    orderToken: 'fixture-checkout',
    djangoPaymentSaveCustomId: 'fixture-payment',
    duplicateDetectedAt: null,
    pushAcknowledgedAt: null as Date | null,
  };
  const previous = global.__merchizeFulfillmentOpsPrisma__;
  const env = { ...process.env };
  Object.assign(process.env, {
    SHOP_OPS_DATA_TARGET: 'dev',
    PAYPAL_TX_LEDGER_NEON_BRANCH: 'dev',
    PAYPAL_TX_LEDGER_NEON_POOLED_DB_DEV_STRING: 'postgresql://fake:fake@localhost:1/unused',
    MERCHIZE_FULFILLMENT_OPS_NEON_BRANCH: 'dev',
    MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_DEV_STRING: 'postgresql://fake:fake@localhost:1/unused',
    MERCHIZE_BO_API_BASE_URL: 'https://merchize.example/bo-api',
    MERCHIZE_API_KEY: 'fixture-key',
  });
  t.after(() => {
    global.__merchizeFulfillmentOpsPrisma__ = previous;
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  });

  const writes = t.mock.fn(
    async ({
      where,
      data,
    }: {
      where: { id: string; lastLookupAt: Date | null };
      data: Partial<HoldLookupOrder> & { deliveryStatus?: string };
    }) => {
      assert.equal(where.id, current.id);
      assert.equal(where.lastLookupAt, current.lastLookupAt);
      assert.deepEqual(
        Object.keys(data).sort(),
        state === 'cancelled_fulfillment'
          ? ['deliveryStatus', 'heldAt', 'lastLookupAt']
          : ['heldAt', 'lastLookupAt'],
      );
      Object.assign(current, data);
      return { count: 1 };
    },
  );
  global.__merchizeFulfillmentOpsPrisma__ = {
    merchizeFulfillmentOrder: {
      findMany: async (query: { select?: { heldAt?: boolean } }) =>
        query.select && !query.select.heldAt ? [] : [{ ...current }],
      updateMany: writes,
    },
    merchizeFulfillmentSyncAttempt: {
      create: async () => assert.fail('No push attempt should be written'),
    },
  } as unknown as NonNullable<typeof previous>;

  let state = 'on_hold';
  const network = t.mock.method(
    globalThis,
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      assert.equal(url.hostname, 'merchize.example');
      const item = { ...detail, order_status: state };
      if (url.pathname.endsWith('/list-orders-detail')) {
        assert.equal(init?.method, 'POST');
        return Response.json({ success: true, data: [item] });
      }
      assert.match(
        url.pathname,
        /\/order-detail$/u,
        'No push, import or PayPal request is allowed',
      );
      assert.equal(init?.method, 'GET');
      return Response.json({ success: true, data: item });
    },
  );

  await runMerchizeFulfillmentLifecycleScanner({ dryRun: true });
  assert.equal(network.mock.callCount(), 0);
  const held = await runMerchizeFulfillmentLifecycleScanner();
  assert.deepEqual(held.holdSync, { candidates: 1, saved: 1, unavailable: 0 });
  assert.ok(current.heldAt);
  assert.equal(await readCustomerFulfillmentHold(current.orderToken, current.djangoPaymentSaveCustomId), current.lastLookupAt);
  const release = () =>
    pushMerchizeFulfillmentOrderToProduction({
      orderToken: current.orderToken,
      merchizeExternalOrderNumber: current.merchizeExternalOrderNumber,
    });
  await assert.rejects(release, { code: MERCHIZE_ORDER_ON_HOLD });
  assert.equal(network.mock.callCount(), 1);

  state = 'unfulfilled';
  current.lastLookupAt = heldAt;
  await runMerchizeFulfillmentLifecycleScanner();
  assert.equal(current.heldAt, null);
  assert.equal(await readCustomerFulfillmentHold(current.orderToken, current.djangoPaymentSaveCustomId), null);
  assert.equal(current.pushVerifiedAt, null);
  assert.equal(network.mock.callCount(), 2);

  state = 'on_hold';
  current.lastLookupAt = heldAt;
  await assert.rejects(release, { code: MERCHIZE_ORDER_ON_HOLD });
  assert.ok(current.heldAt, 'A hold that arrived after readiness was still recorded');
  assert.equal(network.mock.callCount(), 3);
  assert.equal(writes.mock.callCount(), 3);

  state = 'cancelled_fulfillment';
  current.heldAt = null;
  current.lastLookupAt = heldAt;
  await assert.rejects(release, { code: MERCHIZE_FULFILLMENT_CANCELED_CODE });
  assert.equal(current.deliveryStatus, 'cancelled');
  await assert.rejects(release, { code: MERCHIZE_FULFILLMENT_CANCELED_CODE });
  assert.equal(network.mock.callCount(), 4, 'A saved cancellation requires no further provider read');
});

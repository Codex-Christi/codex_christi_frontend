import assert from 'node:assert/strict';
import test from 'node:test';
import { refreshCustomerTracking } from '@/lib/merchizeFulfillmentOps/refreshCustomerTracking';
import { syncMerchizeFulfillmentOperationalSnapshots } from '@/lib/merchizeFulfillmentOps/syncMerchizeFulfillmentOperationalSnapshots';
import { snapshotCheckedAt } from '@/lib/merchizeFulfillmentOps/customerTracking';

test('tracking refresh deduplicates across requests, bounds supplier reads, and preserves failed-source freshness', async (t) => {
  const previousEnv = { ...process.env };
  const previousOps = global.__merchizeFulfillmentOpsPrisma__;
  const previousLedger = global.__paypalTxLedger__;
  Object.assign(process.env, {
    SHOP_OPS_DATA_TARGET: 'dev',
    PAYPAL_TX_LEDGER_NEON_POOLED_DB_DEV_STRING: 'postgresql://fixture:fixture@localhost:1/unused',
    MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_DEV_STRING:
      'postgresql://fixture:fixture@localhost:1/unused',
    MERCHIZE_BO_API_BASE_URL: 'https://merchize.example/bo-api',
    MERCHIZE_API_KEY: 'fixture-key',
  });
  t.after(() => {
    global.__merchizeFulfillmentOpsPrisma__ = previousOps;
    global.__paypalTxLedger__ = previousLedger;
    for (const key of Object.keys(process.env)) if (!(key in previousEnv)) delete process.env[key];
    Object.assign(process.env, previousEnv);
  });
  const old = new Date('2026-01-01T00:00:00Z');
  const row = {
    id: 'ops-1',
    orderToken: 'token-1',
    merchizeExternalOrderNumber: 'ORD-1',
    merchizeIdentifier: 'fixture',
    merchizeOrderId: 'provider-1',
    merchizeOrderCode: null,
    lastProgressSyncAt: old,
    merchizeProgressPayload: { success: true, data: {}, _nextFetchedAt: old.toISOString() },
  };
  let latest: { id: string } | null = null;
  let transaction = Promise.resolve<unknown>(null);
  let sequence = 0;
  const db = {
    $executeRaw: async (sql: TemplateStringsArray) => {
      assert.match(sql.join(''), /pg_advisory_xact_lock/u);
      return 1;
    },
    $transaction: (run: (value: unknown) => Promise<unknown>) => {
      const result = transaction.then(() => run(db));
      transaction = result.catch(() => {});
      return result;
    },
    merchizeFulfillmentOrder: {
      findMany: async ({ take }: { take: number }) => {
        assert.equal(take, 5);
        return [row];
      },
      findFirst: async () => row,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(row, data);
        return row;
      },
    },
    merchizeFulfillmentSyncAttempt: {
      findFirst: async () => latest,
      create: async ({ data }: { data: { action: string } }) => {
        const result = { id: `attempt-${++sequence}` };
        if (data.action === 'customer_tracking_refresh') latest = result;
        return result;
      },
      update: async () => ({}),
    },
  };
  global.__merchizeFulfillmentOpsPrisma__ = db as unknown as NonNullable<
    typeof global.__merchizeFulfillmentOpsPrisma__
  >;
  global.__paypalTxLedger__ = {
    paypalIntent: { findUnique: async () => null },
    paidOrderRecoveryProjection: { delete: async () => ({}) },
  } as unknown as NonNullable<typeof global.__paypalTxLedger__>;
  let reads = 0;
  let operational = false;
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    reads++;
    assert.equal(url.hostname, 'merchize.example');
    if (!operational) assert.match(url.pathname, /\/external\/orders\/(tracking|order-progress)$/u);
    assert.doesNotMatch(url.pathname, /\/push$|\/catalog$|paypal|order-payment|\/process\//u);
    if (url.pathname.endsWith('/order-progress'))
      return Response.json({ success: false }, { status: 503 });
    if (url.pathname.endsWith('/tracking'))
      return Response.json({
        success: true,
        data: {
          external_number: 'ORD-1',
          package_count: 2,
          packages: [
            { package_id: 'one', tracking_number: 'track-one', status: 'delivered' },
            { package_id: 'two', tracking_number: 'track-two', status: 'in_transit' },
          ],
        },
      });
    assert.equal(init?.method, url.pathname.includes('list-orders-ticket') ? 'POST' : 'GET');
    return Response.json({
      success: true,
      data: { order_progress: [{ event: 'production', status: 'done' }] },
    });
  });
  const results = await Promise.all([
    refreshCustomerTracking('token-1'),
    refreshCustomerTracking('token-1'),
  ]);
  assert.equal(results.filter((result) => result.refreshed).length, 1);
  assert.equal(reads, 2, 'Concurrent tabs share a database-backed reservation');
  assert.equal(row.lastProgressSyncAt.toISOString(), old.toISOString());
  assert.equal(snapshotCheckedAt(row.merchizeProgressPayload), old.toISOString());
  assert.equal((row as unknown as { deliveryStatus: string }).deliveryStatus, 'tracking_available');
  await refreshCustomerTracking('token-1');
  assert.equal(reads, 2);
  operational = true;
  await syncMerchizeFulfillmentOperationalSnapshots('token-1', { includeInvoice: false });
  assert.equal(
    row.lastProgressSyncAt.toISOString(),
    old.toISOString(),
    'Internal progress success cannot refresh the displayed external progress timestamp',
  );
  assert.equal(snapshotCheckedAt(row.merchizeProgressPayload), old.toISOString());
});

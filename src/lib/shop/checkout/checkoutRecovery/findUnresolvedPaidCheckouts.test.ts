import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import type { PrismaClient } from '@/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client';
import { findUnresolvedPaidCheckoutsByEmail } from './findUnresolvedPaidCheckouts';

function ledgerRow(id: string, paid = false) {
  return {
    id,
    orderToken: `order-${id}`,
    capturePayload: {
      id: `capture-${id}`,
      status: paid ? 'COMPLETED' : 'DECLINED',
      amount: { currencyCode: 'USD', value: '25.00' },
    },
  };
}

type Query = {
  take: number;
  cursor?: { id: string };
  skip?: number;
  orderBy: unknown;
  select: { id: boolean };
};

function database(t: TestContext, rows: ReturnType<typeof ledgerRow>[]) {
  const previous = global.__paypalTxLedger__;
  const queries: Query[] = [];
  global.__paypalTxLedger__ = {
    paypalIntent: {
      findMany: async (query: Query) => {
        queries.push(query);
        assert.equal(query.take, 10, 'each database read stays bounded');
        assert.deepEqual(query.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
        assert.equal(query.select.id, true);
        const start = query.cursor
          ? rows.findIndex((row) => row.id === query.cursor?.id) + (query.skip ?? 0)
          : 0;
        return rows.slice(start, start + query.take);
      },
    },
  } as unknown as PrismaClient;
  t.after(() => {
    global.__paypalTxLedger__ = previous;
  });
  return queries;
}

test('older captured orders remain discoverable behind more than ten declined attempts', async (t) => {
  const declined = Array.from({ length: 21 }, (_, index) => ledgerRow(`new-${index}`));
  const olderPaid = ledgerRow('older-paid', true);
  const queries = database(t, [...declined, olderPaid]);

  const paid = await findUnresolvedPaidCheckoutsByEmail('customer@example.test');

  assert.deepEqual(
    paid.map((row) => row.orderToken),
    [olderPaid.orderToken],
  );
  assert.equal(queries.length, 3);
  assert.deepEqual(queries[1].cursor, { id: declined[9].id });
  assert.deepEqual(queries[2].cursor, { id: declined[19].id });
  assert.equal(queries[1].skip, 1);
});

test('paging terminates when full declined pages end without a completed capture', async (t) => {
  const queries = database(
    t,
    Array.from({ length: 20 }, (_, index) => ledgerRow(`declined-${index}`)),
  );

  assert.deepEqual(await findUnresolvedPaidCheckoutsByEmail('customer@example.test'), []);
  assert.equal(queries.length, 3, 'the final empty page ends the scan');
});

test('the three-order result limit stops scanning after enough completed captures', async (t) => {
  const rows = Array.from({ length: 30 }, (_, index) => ledgerRow(`paid-${index}`, true));
  const queries = database(t, rows);

  const paid = await findUnresolvedPaidCheckoutsByEmail('customer@example.test');

  assert.deepEqual(
    paid.map((row) => row.orderToken),
    rows.slice(0, 3).map((row) => row.orderToken),
  );
  assert.equal(queries.length, 1);
});

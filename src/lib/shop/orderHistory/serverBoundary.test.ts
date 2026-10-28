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
import { buildAuthSessionCookies } from '@/lib/session/session-cookies';
import { GET as receipt } from '@/app/api/shop/account/orders/[orderToken]/receipt/route';
import { accountOrders } from './server';

function inRequest<T>(cookie: string, run: (req: NextRequest) => Promise<T>) {
  const req = new NextRequest('http://localhost:3000/api/shop/account/orders/token-1/receipt', {
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
    workUnitAsyncStorage.run(store, () => run(req)),
  );
}

async function cookieFor(userId: string) {
  const now = Math.floor(Date.now() / 1000);
  const token = (kind: string) =>
    `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ token_type: kind, user_id: userId, iat: now - 1, exp: now + 300 })).toString('base64url')}.test`;
  const result = await buildAuthSessionCookies({
    accessToken: token('access'),
    refreshToken: token('refresh'),
  });
  return result.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

test('real account reader and receipt route authenticate with server cookies and never mutate orders', async (t) => {
  const previousClient = global.__paypalTxLedger__;
  const previousSecret = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'account-history-test-secret-of-at-least-32-bytes';
  t.after(() => {
    global.__paypalTxLedger__ = previousClient;
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
  });
  const network = t.mock.method(globalThis, 'fetch', async () =>
    assert.fail('History must not call a provider'),
  );
  const record = {
    id: 'id-1',
    orderToken: 'token-1',
    userId: 'owner-a',
    djangoOrderIntentOrderId: 'ORD-1',
    status: 'completed',
    createdAt: new Date(),
    receiptLink: 'https://payment-receipts.codexchristi.shop/paypal/fixture.pdf',
    canonicalOrderSnapshot: null,
    canonicalOrderSnapshotVersion: null,
    canonicalOrderSnapshotHash: null,
    authorizePayload: null,
    capturePayload: {
      id: 'capture',
      status: 'COMPLETED',
      amount: { value: '35.00', currencyCode: 'USD' },
    },
  };
  let reads = 0;
  global.__paypalTxLedger__ = {
    paypalIntent: {
      findFirst: async ({ where }: { where: { userId: string; orderToken: string } }) => {
        reads++;
        return where.userId === record.userId && where.orderToken === record.orderToken
          ? record
          : null;
      },
      findMany: async ({ where }: { where: { userId: string } }) => {
        reads++;
        return where.userId === record.userId ? [record] : [];
      },
    },
  } as unknown as PrismaClient;
  const context = { params: Promise.resolve({ orderToken: 'token-1' }) };
  const anonymous = await inRequest('', (req) => receipt(req, context));
  assert.equal(anonymous.status, 401);
  assert.equal(reads, 0);
  for (const user of ['owner-a', 'owner-b']) {
    const cookie = await cookieFor(user);
    const list = await inRequest(cookie, () => accountOrders.list());
    assert.equal(list.orders.length, user === 'owner-a' ? 1 : 0);
    const response = await inRequest(cookie, (req) => receipt(req, context));
    assert.equal(response.status, user === 'owner-a' ? 307 : 404);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(
      response.headers.get('set-cookie'),
      null,
      'Read-only access must not claim an order',
    );
    assert.equal(response.headers.get('location'), user === 'owner-a' ? record.receiptLink : null);
  }
  record.receiptLink = 'https://other.example/paypal/unsafe.pdf';
  assert.equal(
    (await inRequest(await cookieFor('owner-a'), (req) => receipt(req, context))).status,
    404,
  );
  assert.equal(network.mock.callCount(), 0);
});

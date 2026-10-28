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
import { GET as checkoutReceipt } from '@/app/api/shop/orders/[orderToken]/receipt/route';
import { POST as tracking } from '@/app/api/shop/account/orders/[orderToken]/tracking/route';
import { createCheckoutGrant, checkoutGrantCookieName } from '@/lib/shop/checkout/checkoutProof';
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
  const storageEnv = { ...process.env };
  process.env.SESSION_SECRET = 'account-history-test-secret-of-at-least-32-bytes';
  Object.assign(process.env, {
    R2_ACCOUNT_ID: 'fixture-account',
    R2_PAYMENT_DOCS_BUCKET_NAME: 'fixture-bucket',
    R2_PAYMENT_DOCS_BUCKET_ACCESS_KEY_ID: 'fixture-key',
    R2_PAYMENT_DOCS_BUCKET_SECRET_ACCESS_KEY: 'fixture-secret',
  });
  t.after(() => {
    global.__paypalTxLedger__ = previousClient;
    if (previousSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previousSecret;
    for (const key of Object.keys(process.env)) if (!(key in storageEnv)) delete process.env[key];
    Object.assign(process.env, storageEnv);
  });
  const network = t.mock.method(globalThis, 'fetch', async () =>
    assert.fail('History must not call a provider'),
  );
  const record = {
    id: 'id-1',
    orderToken: 'token-1',
    userId: 'owner-a' as string | null,
    djangoOrderIntentOrderId: 'ORD-1',
    status: 'completed',
    createdAt: new Date(),
    receiptLink: 'https://payment-receipts.codexchristi.shop/paypal/fixture.pdf',
    receiptFile: 'fixture',
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
      findUnique: async () => record,
    },
  } as unknown as PrismaClient;
  const context = { params: Promise.resolve({ orderToken: 'token-1' }) };
  const anonymous = await inRequest('', (req) => receipt(req, context));
  assert.equal(anonymous.status, 401);
  assert.equal(reads, 0);
  const sameOrigin = () =>
    new Request('http://localhost:3000/api/shop/account/orders/token-1/tracking', {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    });
  assert.equal((await inRequest('', () => tracking(sameOrigin(), context))).status, 401);
  assert.equal(
    (await inRequest(await cookieFor('owner-b'), () => tracking(sameOrigin(), context))).status,
    404,
  );
  assert.equal(
    (
      await inRequest(await cookieFor('owner-a'), () =>
        tracking(
          new Request('http://localhost:3000/api/shop/account/orders/token-1/tracking', {
            method: 'POST',
            headers: { origin: 'https://foreign.example' },
          }),
          context,
        ),
      )
    ).status,
    403,
  );
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
    if (user === 'owner-a') {
      const url = new URL(response.headers.get('location')!);
      assert.equal(url.hostname, 'fixture-account.r2.cloudflarestorage.com');
      assert.equal(url.searchParams.get('X-Amz-Expires'), '60');
      assert.match(url.pathname, /fixture-bucket\/paypal\/fixture.pdf$/u);
    } else assert.equal(response.headers.get('location'), null);
  }
  record.receiptLink = 'https://other.example/paypal/unsafe.pdf';
  assert.equal(
    (await inRequest(await cookieFor('owner-a'), (req) => receipt(req, context))).status,
    404,
  );
  record.receiptLink = 'https://payment-receipts.codexchristi.shop/paypal/fixture.pdf';
  record.userId = null;
  assert.equal((await inRequest('', (req) => checkoutReceipt(req, context))).status, 403);
  const grant = `${checkoutGrantCookieName(record.orderToken)}=${createCheckoutGrant(record, 'status')}`;
  const guestDownload = await inRequest(grant, (req) => checkoutReceipt(req, context));
  assert.equal(guestDownload.status, 307, 'Verified guest status access permits a receipt only');
  assert.equal(
    guestDownload.headers.get('set-cookie'),
    null,
    'Receipt access never claims a guest order or mints payment access',
  );
  assert.equal(guestDownload.headers.get('referrer-policy'), 'no-referrer');
  const foreignGrant = `${checkoutGrantCookieName(record.orderToken)}=${createCheckoutGrant({ ...record, orderToken: 'other' }, 'status')}`;
  assert.equal((await inRequest(foreignGrant, (req) => checkoutReceipt(req, context))).status, 403);
  record.userId = 'another-owner';
  assert.equal(
    (await inRequest(grant, (req) => checkoutReceipt(req, context))).status,
    403,
    'An old guest grant cannot follow a claimed order',
  );
  assert.equal(network.mock.callCount(), 0);
});

import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { NextRequest } from 'next/server';
import { createRequestStoreForAPI } from 'next/dist/server/async-storage/request-store';
import {
  workAsyncStorage,
  type WorkStore,
} from 'next/dist/server/app-render/work-async-storage.external';
import { workUnitAsyncStorage } from 'next/dist/server/app-render/work-unit-async-storage.external';
import { buildAuthSessionCookies } from '@/lib/session/session-cookies';
import { GET, POST } from '@/app/api/shop/cart/route';

function setup(t: TestContext) {
  for (const [key, value] of Object.entries({
    NODE_ENV: 'production',
    SESSION_SECRET: 'test-only-cart-boundary-secret-at-least-32-bytes',
    DJANGO_INTERNAL_BASE_URL: 'https://mock.invalid/api/v1',
  })) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
}

async function cookieHeader() {
  const now = Math.floor(Date.now() / 1000);
  const token = (type: string) =>
    `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ token_type: type, user_id: 'user-a', iat: now - 1, exp: now + 300 })).toString('base64url')}.test`;
  const built = await buildAuthSessionCookies({
    accessToken: token('access'),
    refreshToken: token('refresh'),
  });
  return built.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

function request(
  cookie = '',
  body?: unknown,
  ownerId = 'user-a',
  origin = 'https://codexchristi.org',
) {
  return new NextRequest('https://codexchristi.org/next-api/shop/cart', {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      host: 'codexchristi.org',
      'x-forwarded-proto': 'https',
      origin,
      cookie,
      'x-cart-owner': ownerId,
      'content-type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function inRequest<T>(req: NextRequest, run: () => Promise<T>) {
  const store = createRequestStoreForAPI(
    req,
    req.nextUrl,
    { tags: [], expirationsByCacheKind: new Map() },
    undefined,
    undefined,
    undefined,
  );
  return workAsyncStorage.run({ route: '/test' } as WorkStore, () =>
    workUnitAsyncStorage.run(store, run),
  );
}

const remove = { ownerId: 'user-a', action: 'remove', item: { variantId: 'variant-m' } };

test('owner changes and missing credentials are rejected before a Django cart request', async (t) => {
  setup(t);
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Must not send');
  });
  const req = request(await cookieHeader(), undefined, 'user-b');
  const mismatch = await inRequest(req, () => GET(req));
  assert.equal(mismatch.status, 409);
  assert.equal(mismatch.headers.get('cache-control'), 'private, no-store');
  const anonymous = request();
  assert.equal((await inRequest(anonymous, () => GET(anonymous))).status, 401);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('cross-origin writes and oversized bodies cannot reach the signed-in cart', async (t) => {
  setup(t);
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Must not send');
  });
  const foreign = request(await cookieHeader(), remove, 'user-a', 'https://evil.test');
  assert.equal((await inRequest(foreign, () => POST(foreign))).status, 403);
  const huge = request(await cookieHeader(), { ...remove, extra: 'x'.repeat(65536) });
  assert.equal((await inRequest(huge, () => POST(huge))).status, 413);
  const switched = request(await cookieHeader(), { ...remove, ownerId: 'user-b' });
  assert.equal((await inRequest(switched, () => POST(switched))).status, 409);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('Django cart writes use server-only authorization and return only a private acknowledgement', async (t) => {
  setup(t);
  t.mock.method(globalThis, 'fetch', async (url: unknown, init?: RequestInit) => {
    assert.equal(String(url), 'https://mock.invalid/api/v1/cart/remove-items');
    assert.equal(new Headers(init?.headers).get('authorization')?.startsWith('Bearer '), true);
    assert.equal(init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(init?.body)), { items: [{ variantId: 'variant-m' }] });
    return Response.json({ success: true });
  });
  const req = request(await cookieHeader(), remove);
  const response = await inRequest(req, () => POST(req));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await response.json(), { success: true, ownerId: 'user-a' });
});

test('a lost upstream response is uncertain and does not replay a mutation', async (t) => {
  setup(t);
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('private upstream diagnostics');
  });
  const req = request(await cookieHeader(), remove);
  const response = await inRequest(req, () => POST(req));
  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.uncertain, true);
  assert.equal(JSON.stringify(body).includes('private upstream'), false);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('permission rejection is definite, while malformed successful writes need reconciliation', async (t) => {
  setup(t);
  let response = Response.json({ success: false }, { status: 403 });
  t.mock.method(globalThis, 'fetch', async () => response);
  const denied = request(await cookieHeader(), remove);
  const deniedResponse = await inRequest(denied, () => POST(denied));
  assert.equal(deniedResponse.status, 403);
  assert.equal((await deniedResponse.json()).uncertain, false);
  response = Response.json({ message: 'missing success' });
  const malformed = request(await cookieHeader(), remove);
  const malformedResponse = await inRequest(malformed, () => POST(malformed));
  assert.equal(malformedResponse.status, 502);
  assert.equal((await malformedResponse.json()).uncertain, true);
});

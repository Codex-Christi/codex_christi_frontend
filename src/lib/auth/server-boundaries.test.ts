import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { NextRequest } from 'next/server';
import { createRequestStoreForAPI } from 'next/dist/server/async-storage/request-store';
import {
  workAsyncStorage,
  type WorkStore,
} from 'next/dist/server/app-render/work-async-storage.external';
import {
  workUnitAsyncStorage,
  type RequestStore,
} from 'next/dist/server/app-render/work-unit-async-storage.external';
import { authenticatedDjangoFetch } from './authenticated-django-fetch';
import { buildAuthSessionCookies } from '../session/session-cookies';
import {
  redirectExpSessionToLoginPage,
  protectAdminRouteMiddleware,
} from '../middlewares/auth-middleware';
import { GET, POST } from '@/app/api/logout/route';
import { getAdminOpsLedgerPrisma } from '../prisma/adminOpsLedger/adminOpsLedgerPrisma';
import useAuthStore from '@/stores/authStore';
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';
import { useUserShopProfile } from '@/stores/shop_stores/use-user-shop-profile';
import { getUser } from '@/lib/funcs/userProfileFetchers/getUser';
import { getServerAuthSnapshot } from '../session/server-session';
import { useEditUserMainProfileStore } from '@/stores/editUserProfileStore';
import { POST as resetPassword } from '@/app/api/auth/password-reset/route';
import { getServerRefreshToken } from '../session/server-session';
import { assertSessionRefreshActive } from '../session/session-refresh';

function env(t: TestContext, key: string, value: string) {
  const previous = process.env[key];
  process.env[key] = value;
  t.after(() => {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  });
}
function setup(t: TestContext) {
  env(t, 'NODE_ENV', 'production');
  env(t, 'SESSION_SECRET', 'test-only-server-boundary-secret-at-least-32-bytes');
  env(t, 'DJANGO_INTERNAL_BASE_URL', 'https://mock.invalid/api/v1');
}
const jwt = (type: string, id = 'user-a', seconds = 300) => {
  const now = Math.floor(Date.now() / 1000);
  return `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ token_type: type, user_id: id, iat: now - 1, exp: now + seconds })).toString('base64url')}.test`;
};
async function cookieHeader(id = 'user-a') {
  const built = await buildAuthSessionCookies({
    accessToken: jwt('access', id),
    refreshToken: jwt('refresh', id, 3600),
  });
  return built.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}
function request(path: string, cookie = '', method = 'GET') {
  return new NextRequest(`https://codexchristi.org${path}`, {
    method,
    headers: {
      host: 'codexchristi.org',
      'x-forwarded-proto': 'https',
      origin: 'https://codexchristi.org',
      cookie,
    },
  });
}
function inRequest<T>(req: NextRequest, run: (store: RequestStore) => Promise<T>) {
  // Installed Next's real request stores enforce the cookie-write boundary in these tests.
  const store = createRequestStoreForAPI(
    req,
    req.nextUrl,
    { tags: [], expirationsByCacheKind: new Map() },
    undefined,
    undefined,
    undefined,
  );
  return workAsyncStorage.run({ route: '/test' } as WorkStore, () =>
    workUnitAsyncStorage.run(store, () => run(store)),
  );
}

test('GET logout never mutates; cross-origin POST is refused', async (t) => {
  setup(t);
  assert.equal((await GET()).status, 405);
  const bad = new Request('https://codexchristi.org/next-api/logout', {
    method: 'POST',
    headers: { host: 'codexchristi.org', origin: 'https://evil.test' },
  });
  const response = await POST(bad);
  assert.equal(response.status, 403);
  assert.equal(response.headers.has('Set-Cookie'), false);
});

test('logout expires access, refresh and BOTH admin cookie paths during a Django outage', async (t) => {
  setup(t);
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('offline');
  });
  const req = request('/next-api/logout', await cookieHeader('logout-test'), 'POST');
  const response = await inRequest(req, () => POST(req));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 4);
  assert.ok(cookies.some((value) => value.startsWith('session=') && value.includes('Max-Age=0')));
  assert.ok(
    cookies.some((value) => value.startsWith('refreshToken=') && value.includes('Max-Age=0')),
  );
  const admin = cookies.filter(
    (value) => !value.startsWith('session=') && !value.startsWith('refreshToken='),
  );
  assert.ok(admin.some((value) => /Path=\/admin;/.test(value)));
  assert.ok(admin.some((value) => /Path=\/;/.test(value)));
});

test('protected profile children retain destination; POST is never redirected/replayed', async (t) => {
  setup(t);
  const response = await redirectExpSessionToLoginPage(request('/profile/edit?tab=photo'));
  const url = new URL(response.headers.get('Location')!);
  assert.equal(url.pathname, '/auth/sign-in');
  assert.equal(url.searchParams.get('next'), '/profile/edit?tab=photo');
  const post = await redirectExpSessionToLoginPage(request('/profile/edit', '', 'POST'));
  assert.equal(post.headers.has('Location'), false);
});

test('cold-page refresh outages redirect to retry/logout UI, preserving safe destinations and cookies', async (t) => {
  setup(t);
  t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 503 }));
  const refreshOnly = (await cookieHeader('outage-rewrite'))
    .split('; ')
    .filter((value) => value.startsWith('refreshToken='))
    .join('; ');
  for (const [host, path, destination, next] of [
    [
      'codexchristi.org',
      '/profile/edit?tab=photo',
      '/auth/session-unavailable',
      '/profile/edit?tab=photo',
    ],
    [
      'codexchristi.org',
      '/shop/account-overview?tab=address',
      '/shop/auth/session-unavailable',
      '/shop/account-overview?tab=address',
    ],
    [
      'codexchristi.shop',
      '/shop/account-overview?tab=address',
      '/auth/session-unavailable',
      '/account-overview?tab=address',
    ],
    ['codexchristi.org', '/admin/shop', '/auth/session-unavailable', '/admin/shop'],
  ]) {
    const req = new NextRequest(`https://${host}${path}`, {
      headers: { host, cookie: refreshOnly },
    });
    const response = path.startsWith('/admin')
      ? await protectAdminRouteMiddleware(req)
      : await redirectExpSessionToLoginPage(req);
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(response.headers.get('Retry-After'), '5');
    assert.equal(response.headers.has('Set-Cookie'), false);
    assert.equal(response.headers.has('x-middleware-rewrite'), false);
    const location = new URL(response.headers.get('Location')!);
    assert.equal(location.pathname, destination);
    assert.equal(location.searchParams.get('next'), next);
    assert.equal(location.host, host);
  }
});

function passwordRequest(input: unknown, cookie = '', origin = 'https://codexchristi.org') {
  return new NextRequest('https://codexchristi.org/next-api/auth/password-reset', {
    method: 'POST',
    headers: { host: 'codexchristi.org', origin, cookie, 'Content-Type': 'application/json' },
    body: typeof input === 'string' ? input : JSON.stringify(input),
  });
}
const resetInput = (name: string) => ({
  email: `${name}@example.test`,
  otp: '123456',
  password: 'Synthetic-only-Password9!',
});

test('successful password reset clears access, refresh and BOTH admin paths and cancels old refresh', async (t) => {
  setup(t);
  const mock = t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    assert.ok(url.endsWith('/account/forgotten-password-reset'));
    assert.equal(init?.method, 'POST');
    assert.equal(init?.cache, 'no-store');
    return Response.json({ success: true, data: { unused: 'must not be returned' } });
  });
  const req = passwordRequest(resetInput('reset-success'), await cookieHeader('reset-browser'));
  const response = await inRequest(req, async () => {
    const refresh = await getServerRefreshToken();
    assert.ok(refresh);
    const result = await resetPassword(req);
    assert.throws(() => assertSessionRefreshActive(refresh), /session expired/);
    return result;
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(await response.json(), { success: true });
  const expired = response.headers.getSetCookie();
  assert.equal(expired.length, 4);
  for (const name of ['session', 'refreshToken'])
    assert.ok(expired.some((value) => value.startsWith(`${name}=`) && value.includes('Max-Age=0')));
  const admin = expired.filter((value) => value.startsWith('admin_session='));
  assert.ok(admin.some((value) => /Path=\/admin;/.test(value)));
  assert.ok(admin.some((value) => /Path=\/;/.test(value)));
  assert.equal(mock.mock.callCount(), 1);
});

test('invalid, cross-origin and oversized password resets never reach Django or clear cookies', async (t) => {
  setup(t);
  const mock = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Unexpected fetch');
  });
  for (const [req, status] of [
    [passwordRequest(resetInput('cross-origin'), '', 'https://evil.test'), 403],
    [passwordRequest({ ...resetInput('invalid-code'), otp: 'bad' }), 400],
    [passwordRequest('not json'), 400],
    [passwordRequest('x'.repeat(8193)), 413],
  ] as const) {
    const response = await resetPassword(req);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(response.headers.has('Set-Cookie'), false);
  }
  assert.equal(mock.mock.callCount(), 0);
});

test('rejected or unavailable password reset preserves the current browser login', async (t) => {
  setup(t);
  for (const status of [400, 503]) {
    const mock = t.mock.method(globalThis, 'fetch', async () =>
      Response.json({ success: false }, { status }),
    );
    const req = passwordRequest(
      resetInput(`reset-failure-${status}`),
      await cookieHeader(`reset-${status}`),
    );
    const response = await inRequest(req, () => resetPassword(req));
    assert.equal(response.status, status);
    assert.equal(response.headers.has('Set-Cookie'), false);
    mock.mock.restore();
  }
});

test('shop protected destinations use public paths on .shop and prefixes on .org', async (t) => {
  setup(t);
  const shop = new NextRequest('https://codexchristi.shop/shop/account-overview', {
    headers: { host: 'codexchristi.shop', 'x-forwarded-proto': 'https' },
  });
  const shopUrl = new URL((await redirectExpSessionToLoginPage(shop)).headers.get('Location')!);
  assert.equal(shopUrl.pathname, '/auth/login');
  assert.equal(shopUrl.searchParams.get('next'), '/account-overview');
  const orgUrl = new URL(
    (await redirectExpSessionToLoginPage(request('/shop/account-overview'))).headers.get(
      'Location',
    )!,
  );
  assert.equal(orgUrl.pathname, '/shop/auth/login');
  assert.equal(orgUrl.searchParams.get('next'), '/shop/account-overview');
});

test('a normal login does not bypass admin unlock', async (t) => {
  setup(t);
  const response = await protectAdminRouteMiddleware(request('/admin/shop', await cookieHeader()));
  assert.equal(new URL(response.headers.get('Location')!).pathname, '/admin/unlock');
});

test('read-only fetch never tries to refresh or write cookies', async (t) => {
  setup(t);
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({}));
  await inRequest(request('/profile'), () =>
    assert.rejects(authenticatedDjangoFetch('/account/my-profile'), /Sign in again/),
  );
  assert.equal(mock.mock.callCount(), 0);
});

test('the admin render profile reader does not call a writable action on upstream 401', async (t) => {
  setup(t);
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status: 401 }));
  await inRequest(request('/admin', await cookieHeader('render-only')), async (store) => {
    store.phase = 'render';
    assert.equal(await getUser(), undefined);
    assert.equal(store.mutableCookies.get('session')?.value === '', false);
  });
  assert.equal(mock.mock.callCount(), 1);
});

test('account layout snapshot is read-only, contains no tokens and makes no upstream request', async (t) => {
  setup(t);
  const mock = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('No upstream request expected');
  });
  await inRequest(request('/profile', await cookieHeader('bootstrap-user')), async (store) => {
    store.phase = 'render';
    const snapshot = await getServerAuthSnapshot();
    assert.equal(snapshot.user_id, 'bootstrap-user');
    assert.equal(snapshot.status, 'authenticated');
    assert.deepEqual(Object.keys(snapshot).sort(), [
      'expiresAt',
      'isAuthenticated',
      'status',
      'user_id',
    ]);
    assert.equal(store.mutableCookies.get('session')?.value === '', false);
  });
  assert.equal(mock.mock.callCount(), 0);
});

test('authenticated reads refresh once after 401 and forward only the server token', async (t) => {
  setup(t);
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    calls.push(url);
    if (url.endsWith('/auth/token/refresh'))
      return Response.json({ access: jwt('access'), refresh: jwt('refresh', 'user-a', 3600) });
    assert.ok(new Headers(init?.headers).get('Authorization')?.startsWith('Bearer '));
    return Response.json({}, { status: calls.length === 1 ? 401 : 200 });
  });
  await inRequest(request('/profile', await cookieHeader()), async () => {
    assert.equal(
      (await authenticatedDjangoFetch('/account/my-profile', {}, { writable: true })).status,
      200,
    );
  });
  assert.deepEqual(
    calls.map((value) => new URL(value).pathname),
    ['/api/v1/account/my-profile', '/api/v1/auth/token/refresh', '/api/v1/account/my-profile'],
  );
});

test('403/404 are not treated as logout and a non-allowlisted mutation is not retried', async (t) => {
  setup(t);
  for (const status of [403, 404, 401]) {
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json({}, { status }));
    await inRequest(request('/profile', await cookieHeader(`status-${status}`)), async (store) => {
      const result = authenticatedDjangoFetch(
        '/account/my-profile-update',
        { method: 'PATCH' },
        { writable: true },
      );
      if (status === 404) assert.equal((await result).status, 404);
      else await assert.rejects(result, (error) => (error as { status: number }).status === status);
      assert.equal(store.mutableCookies.get('session')?.value === '', status === 401);
    });
    assert.equal(fetchMock.mock.callCount(), 1);
    fetchMock.mock.restore();
  }
});

test('production reuses one admin Prisma client without querying a database', async (t) => {
  setup(t);
  env(t, 'NEON_ADMIN_OPS_LEDGER_POOLED_URL', 'postgresql://test:test@127.0.0.1:1/test');
  assert.equal(getAdminOpsLedgerPrisma(), getAdminOpsLedgerPrisma());
});

test('a late profile response cannot repopulate the previous account after switching users', async (t) => {
  setup(t);
  useAuthStore.getState().setSessionState({ isAuthenticated: true, user_id: 'user-a' });
  useUserMainProfileStore.getState().clearProfile();
  let resolve!: (response: Response) => void;
  const fetchMock = t.mock.method(
    globalThis,
    'fetch',
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  await inRequest(request('/profile', await cookieHeader()), async () => {
    const pending = useUserMainProfileStore.getState().setProfileFromServer();
    const sameRequest = useUserMainProfileStore.getState().setProfileFromServer();
    while (!resolve) await new Promise(setImmediate);
    assert.equal(fetchMock.mock.callCount(), 1);
    useAuthStore.getState().setSessionState({ isAuthenticated: true, user_id: 'user-b' });
    useUserMainProfileStore.getState().clearProfile();
    resolve(Response.json({ success: true, data: { id: 'user-a', email: 'a@example.com' } }));
    await Promise.all([pending, sameRequest]);
    assert.equal(useUserMainProfileStore.getState().userMainProfile, null);
  });
  useAuthStore.getState().setSessionState({ isAuthenticated: false, user_id: null });
});

test('a missing shop profile or backend outage leaves the login intact', async (t) => {
  setup(t);
  for (const status of [404, 503]) {
    useAuthStore.getState().setSessionState({ isAuthenticated: true, user_id: 'user-a' });
    const mock = t.mock.method(globalThis, 'fetch', async () =>
      Response.json({ success: false, message: 'Profile unavailable.' }, { status }),
    );
    await inRequest(request('/shop/account-overview', await cookieHeader()), () =>
      useUserShopProfile.getState().setProfileFromServer(),
    );
    assert.equal(useAuthStore.getState().isAuthenticated, true);
    assert.equal(useUserShopProfile.getState().isLoading, false);
    assert.equal(useUserShopProfile.getState().userShopProfile, null);
    assert.ok(useUserShopProfile.getState().error);
    mock.mock.restore();
  }
  useAuthStore.getState().setSessionState({ isAuthenticated: false, user_id: null });
});

test('temporary profile failures preserve the same owner cache and unsaved edits', async (t) => {
  setup(t);
  useAuthStore.getState().setSessionState({ isAuthenticated: true, user_id: 'user-a' });
  const profile = { id: 'user-a', email: 'a@example.com', first_name: 'Original' };
  const edits = { first_name: 'Unsaved' };
  useUserMainProfileStore.getState().setUserMainProfile(profile);
  useEditUserMainProfileStore.getState().setUserEditData(edits);
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ success: false }, { status: 503 }),
  );
  await inRequest(request('/profile', await cookieHeader()), () =>
    useUserMainProfileStore.getState().setProfileFromServer(),
  );
  useAuthStore
    .getState()
    .setSessionState({ isAuthenticated: false, user_id: null, status: 'unavailable' });
  await useUserMainProfileStore.getState().setProfileFromServer();
  assert.deepEqual(useUserMainProfileStore.getState().userMainProfile, profile);
  assert.deepEqual(useEditUserMainProfileStore.getState().userEditData, edits);
  assert.equal(useAuthStore.getState().accountOwnerId, 'user-a');
  useEditUserMainProfileStore.getState().clearEditData();
  useUserMainProfileStore.getState().clearProfile();
  useAuthStore.getState().setSessionState({ isAuthenticated: false, user_id: null });
});

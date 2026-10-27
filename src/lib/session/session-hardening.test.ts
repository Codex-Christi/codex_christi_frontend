import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';

function setEnv(t: TestContext, key: string, value: string) {
  const previous = process.env[key];
  process.env[key] = value;
  t.after(() => {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  });
}
import { SignJWT } from 'jose';
import {
  buildAuthSessionCookies,
  decryptSessionToken,
  encryptSessionPayload,
  getMainAccessTokenFromCookieValue,
  getMainRefreshTokenFromCookieValue,
  shouldUseSecureCookie,
} from './session-cookies';
import { deriveSessionState } from './session-state';
import {
  refreshDjangoSessionTokens,
  cancelSessionRefresh,
  assertSessionRefreshActive,
  SessionRefreshError,
} from './session-refresh';

const secret = 'test-only-session-secret-at-least-32-bytes';
const jwt = (type: string, id = 'user-a', seconds = 300) => {
  const now = Math.floor(Date.now() / 1000);
  return `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ token_type: type, user_id: id, iat: now - 1, exp: now + seconds })).toString('base64url')}.testsignature`;
};

test('new cookies are HttpOnly, versioned and token-kind isolated', async (t) => {
  setEnv(t, 'SESSION_SECRET', secret);
  setEnv(t, 'NODE_ENV', 'production');
  const access = jwt('access');
  const refresh = jwt('refresh', 'user-a', 3600);
  const built = await buildAuthSessionCookies({
    accessToken: access,
    refreshToken: refresh,
    requestHeaders: new Headers({ 'x-forwarded-proto': 'http' }),
  });
  const [a, r] = built.cookies;
  assert.equal(a.options.httpOnly, true);
  assert.equal(a.options.secure, true);
  assert.equal(a.options.sameSite, 'lax');
  assert.equal(a.options.path, '/');
  assert.ok(a.value.length < 4096 && r.value.length < 4096);
  assert.equal(await getMainAccessTokenFromCookieValue(a.value), access);
  assert.equal(await getMainRefreshTokenFromCookieValue(r.value), refresh);
  assert.equal(await getMainAccessTokenFromCookieValue(r.value), null);
  assert.equal(await getMainRefreshTokenFromCookieValue(a.value), null);
  assert.equal((await decryptSessionToken(a.value))?.version, 2);
});

test('tampered, legacy, expired and weak-secret cookies fail closed', async (t) => {
  setEnv(t, 'SESSION_SECRET', secret);
  const legacy = await new SignJWT({ userID: 'user-a', mainAccessToken: 'old' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('5m')
    .sign(new TextEncoder().encode(secret));
  assert.equal(await decryptSessionToken(legacy), undefined);
  const current = await encryptSessionPayload(
    { version: 2, kind: 'access', userID: 'user-a', mainAccessToken: 'value' },
    new Date(Date.now() + 60_000),
  );
  assert.equal(await decryptSessionToken(`x${current.slice(1)}`), undefined);
  const expired = await encryptSessionPayload({ version: 2, kind: 'access' }, new Date(0));
  assert.equal(await decryptSessionToken(expired), undefined);
  setEnv(t, 'SESSION_SECRET', 'weak');
  await assert.rejects(encryptSessionPayload({}, new Date(Date.now() + 60_000)));
});

test('cookie construction refuses wrong kinds, expired tokens and mismatched users', async (t) => {
  setEnv(t, 'SESSION_SECRET', secret);
  await assert.rejects(
    buildAuthSessionCookies({ accessToken: jwt('refresh'), refreshToken: jwt('refresh') }),
  );
  await assert.rejects(
    buildAuthSessionCookies({
      accessToken: jwt('access', 'user-a', -5),
      refreshToken: jwt('refresh'),
    }),
  );
  await assert.rejects(
    buildAuthSessionCookies({ accessToken: jwt('access'), refreshToken: jwt('refresh', 'user-b') }),
  );
});

test('authentication requires the complete signed payload, not merely an expiry', () => {
  const exp = Date.now() / 1000 + 120;
  for (const payload of [
    { exp },
    { version: 2, kind: 'refresh', exp },
    { version: 2, kind: 'access', exp, userID: 'a' },
  ])
    assert.equal(deriveSessionState(payload).isAuthenticated, false);
  const payload = { version: 2, kind: 'access', exp, userID: 'a', mainAccessToken: 'token' };
  assert.equal(deriveSessionState(payload).isAuthenticated, true);
  assert.equal(deriveSessionState(payload).expiresSoon, false);
  assert.equal(deriveSessionState({ ...payload, exp: Date.now() / 1000 + 20 }).expiresSoon, true);
  assert.equal(deriveSessionState({ ...payload, exp: 1 }).isAuthenticated, false);
});

test('production Secure cookies do not trust a downgraded forwarded protocol', (t) => {
  setEnv(t, 'NODE_ENV', 'production');
  assert.equal(shouldUseSecureCookie(new Headers({ 'x-forwarded-proto': 'http' })), true);
  setEnv(t, 'NODE_ENV', 'development');
  assert.equal(shouldUseSecureCookie(new Headers({ 'x-forwarded-proto': 'http' })), false);
});

function mockRefreshEnv(t: TestContext) {
  setEnv(t, 'NODE_ENV', 'test');
  setEnv(t, 'NEXT_PUBLIC_DJANGO_API_BASE_URL', 'https://mock.invalid/api/v1');
  setEnv(t, 'DJANGO_PREFER_INTERNAL_BASE_URL', 'false');
}

test('parallel refreshes share one upstream call and retain access-only response compatibility', async (t) => {
  mockRefreshEnv(t);
  const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ access: 'new-access' }),
  );
  const results = await Promise.all([
    refreshDjangoSessionTokens('parallel'),
    refreshDjangoSessionTokens('parallel'),
  ]);
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.deepEqual(results[0], { accessToken: 'new-access', refreshToken: 'parallel' });
});

test('only confirmed invalid refresh tokens trigger session removal', async (t) => {
  mockRefreshEnv(t);
  for (const [status, body, invalid] of [
    [401, {}, true],
    [400, { code: 'token_not_valid' }, true],
    [400, {}, false],
    [403, {}, false],
    [429, {}, false],
    [503, {}, false],
    [200, {}, false],
  ] as const) {
    const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
      Response.json(body, { status }),
    );
    await assert.rejects(
      refreshDjangoSessionTokens(`status-${status}-${invalid}`),
      (error: unknown) => error instanceof SessionRefreshError && error.invalid === invalid,
    );
    fetchMock.mock.restore();
  }
});

test('logout cancels a refresh already in progress in this process', async (t) => {
  mockRefreshEnv(t);
  let resolve!: (response: Response) => void;
  t.mock.method(
    globalThis,
    'fetch',
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  const pending = refreshDjangoSessionTokens('cancelled-token');
  cancelSessionRefresh('cancelled-token');
  resolve(Response.json({ access: 'late', refresh: 'rotated' }));
  await assert.rejects(
    pending,
    (error: unknown) => error instanceof SessionRefreshError && error.invalid,
  );
  assert.throws(() => assertSessionRefreshActive('cancelled-token'));
  await assert.rejects(refreshDjangoSessionTokens('cancelled-token'));
});

import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createAuthStore } from '@/stores/authStore';
import { getAuthGeneration } from './session-generation';
import { startSessionMonitor } from './session-monitor';
import { accountViewState } from './account-view-state';
import { isBootstrappedAccountPath, type AuthSessionState } from './session-snapshot';

const signedIn = (id = 'a', ttl = 60_000): AuthSessionState => ({
  isAuthenticated: true,
  user_id: id,
  expiresAt: Date.now() + ttl,
  status: 'authenticated',
});
const unavailable: AuthSessionState = {
  isAuthenticated: false,
  user_id: null,
  status: 'unavailable',
};
const anonymous: AuthSessionState = { isAuthenticated: false, user_id: null, status: 'anonymous' };
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
async function advance(t: TestContext, ms: number) {
  t.mock.timers.tick(ms);
  await flush();
}
function clock(t: TestContext) {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 100_000 });
}

test('unchanged expiry after proactive failure retries three times, then stops and hides expired access', async (t) => {
  clock(t);
  const initial = signedIn('a', 20_000);
  let calls = 0;
  const store = createAuthStore(async () => {
    calls++;
    return initial.expiresAt! > Date.now() ? { ...initial, retryable: true } : unavailable;
  });
  store.getState().seedServerSession(initial);
  const generation = getAuthGeneration();
  const monitor = startSessionMonitor(store, { isVisible: () => true, checkOnStart: false });
  t.after(monitor.stop);
  await advance(t, 5_000);
  assert.equal(calls, 1);
  await advance(t, 2_000);
  assert.equal(calls, 2);
  await advance(t, 5_000);
  assert.equal(calls, 3);
  await advance(t, 8_000);
  assert.equal(store.getState().status, 'unavailable');
  assert.equal(store.getState().isAuthenticated, false);
  assert.equal(store.getState().accountOwnerId, 'a');
  assert.equal(getAuthGeneration(), generation);
  await advance(t, 7_000);
  assert.equal(calls, 4);
  await advance(t, 120_000);
  assert.equal(calls, 4);
  assert.equal(store.getState().nextRetryAt, null);
});

test('successful retry resets backoff and schedules the new expiry', async (t) => {
  clock(t);
  let calls = 0;
  const initial = signedIn('a', 20_000);
  const store = createAuthStore(async () =>
    ++calls === 1 ? { ...initial, retryable: true } : signedIn(),
  );
  store.getState().seedServerSession(initial);
  const monitor = startSessionMonitor(store, { isVisible: () => true, checkOnStart: false });
  t.after(monitor.stop);
  await advance(t, 5_000);
  await advance(t, 2_000);
  assert.equal(calls, 2);
  assert.equal(store.getState().retryCount, 0);
  assert.equal(store.getState().nextRetryAt, null);
  await advance(t, 44_000);
  assert.equal(calls, 2);
  await advance(t, 1_000);
  assert.equal(calls, 3);
});

test('hidden tabs do not retry; resume checks actual expiry and recovers', async (t) => {
  clock(t);
  let visible = true;
  let calls = 0;
  const store = createAuthStore(async () => {
    calls++;
    return signedIn();
  });
  store.getState().seedServerSession(signedIn('a', 20_000));
  const monitor = startSessionMonitor(store, { isVisible: () => visible, checkOnStart: false });
  t.after(monitor.stop);
  visible = false;
  monitor.resume();
  await advance(t, 30_000);
  assert.equal(calls, 0);
  visible = true;
  monitor.resume();
  assert.equal(store.getState().isAuthenticated, false);
  await flush();
  assert.equal(calls, 1);
  assert.equal(store.getState().status, 'authenticated');
});

test('a server-bootstrap page skips its initial action regardless of provider mount order', async (t) => {
  clock(t);
  let calls = 0;
  const store = createAuthStore(async () => {
    calls++;
    return signedIn();
  });
  const monitor = startSessionMonitor(store, { isVisible: () => true, checkOnStart: false });
  t.after(monitor.stop);
  await flush();
  assert.equal(calls, 0);
  store.getState().seedServerSession(signedIn());
  monitor.resume();
  await flush();
  assert.equal(calls, 0);
  await advance(t, 44_000);
  assert.equal(calls, 0);
  await advance(t, 1_000);
  assert.equal(calls, 1);
});

test('public-page checks and focus events share one pending request', async (t) => {
  clock(t);
  let resolve!: (value: AuthSessionState) => void;
  let calls = 0;
  const store = createAuthStore(() => {
    calls++;
    return new Promise((done) => {
      resolve = done;
    });
  });
  const monitor = startSessionMonitor(store, { isVisible: () => true });
  t.after(monitor.stop);
  monitor.resume();
  monitor.resume();
  assert.equal(calls, 1);
  resolve(signedIn());
  await flush();
  monitor.resume();
  await flush();
  assert.equal(calls, 1);
});

test('expiry hides content even while a session request is pending', async (t) => {
  clock(t);
  let resolve!: (value: AuthSessionState) => void;
  const store = createAuthStore(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  store.getState().seedServerSession(signedIn('a', 20_000));
  const monitor = startSessionMonitor(store, { isVisible: () => true, checkOnStart: false });
  t.after(monitor.stop);
  await advance(t, 5_000);
  assert.equal(store.getState().isRefreshing, true);
  await advance(t, 15_000);
  assert.equal(accountViewState(store.getState()).visible, false);
  assert.equal(accountViewState(store.getState()).retainContent, true);
  resolve(signedIn());
  await flush();
  assert.equal(accountViewState(store.getState()).visible, true);
});

test('outage and same-owner recovery retain the account generation; actual logout/account switch invalidate it', (t) => {
  clock(t);
  const store = createAuthStore(async () => unavailable);
  store.getState().seedServerSession(signedIn());
  const generation = getAuthGeneration();
  store.getState().setSessionState(unavailable);
  assert.equal(store.getState().accountOwnerId, 'a');
  assert.equal(store.getState().userSessionInfo, null);
  assert.equal(getAuthGeneration(), generation);
  store.getState().setSessionState(signedIn());
  assert.equal(getAuthGeneration(), generation);
  store.getState().setSessionState(signedIn('b'));
  assert.ok(getAuthGeneration() > generation);
  store.getState().setSessionState(anonymous);
  assert.equal(store.getState().accountOwnerId, null);
  assert.equal(accountViewState(store.getState()).retainContent, false);
});

test('expired or cached bootstraps never resurrect a confirmed logout or overwrite another account', (t) => {
  clock(t);
  const store = createAuthStore();
  const cached = signedIn();
  store.getState().setSessionState(anonymous);
  store.getState().seedServerSession(cached);
  assert.equal(store.getState().status, 'anonymous');
  assert.equal(accountViewState(store.getState(), cached).visible, false);
  store.getState().setSessionState(signedIn('b'));
  store.getState().seedServerSession(cached);
  assert.equal(store.getState().accountOwnerId, 'b');
  const cold = createAuthStore();
  cold.getState().seedServerSession(signedIn('a', -1));
  assert.equal(cold.getState().isAuthenticated, false);
});

test('an older pending check cannot overwrite a fresh bootstrap or later logout', async (t) => {
  clock(t);
  let resolve!: (value: AuthSessionState) => void;
  const store = createAuthStore(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = store.getState().refreshAuthState();
  store.getState().seedServerSession(signedIn());
  resolve(anonymous);
  await pending;
  assert.equal(store.getState().isAuthenticated, true);
  const pendingAgain = store.getState().refreshAuthState();
  store.getState().setSessionState(anonymous);
  resolve(signedIn());
  await pendingAgain;
  assert.equal(store.getState().status, 'anonymous');
});

test('manual retry resets an exhausted budget without clearing the owner', async (t) => {
  clock(t);
  const store = createAuthStore(async () => unavailable);
  store.getState().seedServerSession(signedIn());
  for (let i = 0; i < 4; i++) await store.getState().refreshAuthState();
  assert.equal(store.getState().nextRetryAt, null);
  await store.getState().refreshAuthState({ resetRetries: true });
  assert.equal(store.getState().retryCount, 1);
  assert.equal(store.getState().nextRetryAt, Date.now() + 2_000);
  assert.equal(store.getState().accountOwnerId, 'a');
});

test('cold account rendering uses safe bootstrap immediately; unavailable state keeps a hidden owner-keyed subtree', (t) => {
  clock(t);
  const store = createAuthStore();
  const bootstrap = signedIn();
  assert.equal(accountViewState(store.getState(), bootstrap).visible, true);
  assert.equal(store.getState().status, 'unknown');
  store.getState().seedServerSession(bootstrap);
  const before = accountViewState(store.getState());
  store.getState().setSessionState(unavailable);
  const outage = accountViewState(store.getState());
  assert.equal(outage.ownerId, before.ownerId);
  assert.equal(outage.retainContent, true);
  assert.equal(outage.visible, false);
  store.getState().setSessionState(signedIn('b'));
  assert.notEqual(accountViewState(store.getState()).ownerId, before.ownerId);
});

test('only the two protected account surfaces skip startup checks; public catalog paths stay independent', () => {
  for (const path of [
    '/profile',
    '/profile/edit',
    '/shop/account-overview',
    '/account-overview/shipping-address',
  ])
    assert.equal(isBootstrappedAccountPath(path), true);
  for (const path of ['/shop', '/shop/product/x', '/shop/checkout', '/profiles', '/auth/sign-in'])
    assert.equal(isBootstrappedAccountPath(path), false);
});

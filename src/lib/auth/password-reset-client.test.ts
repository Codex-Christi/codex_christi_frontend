import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { resetPasswordAndSignOut } from './password-reset-client';
import useAuthStore from '@/stores/authStore';
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';
import { useEditUserMainProfileStore } from '@/stores/editUserProfileStore';
import { getAuthGeneration } from './session-generation';
import { clearPrivateClientState } from './client-session';

const input = { email: 'reset@example.test', otp: '123456', password: 'Synthetic-only-Password9!' };
function signedIn(t: TestContext) {
  useAuthStore.getState().setSessionState({ isAuthenticated: true, user_id: 'reset-user' });
  useUserMainProfileStore.getState().setUserMainProfile({ id: 'reset-user', email: input.email });
  useEditUserMainProfileStore.getState().setUserEditData({ first_name: 'Unsaved' });
  t.after(async () => {
    await clearPrivateClientState();
    useAuthStore.getState().setSessionState({ isAuthenticated: false, user_id: null });
  });
}

test('confirmed password reset clears private state and notifies same-origin tabs', async (t) => {
  signedIn(t);
  const generation = getAuthGeneration();
  const messages: Array<{ type: string }> = [];
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'BroadcastChannel');
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'BroadcastChannel', descriptor);
    else Reflect.deleteProperty(globalThis, 'BroadcastChannel');
  });
  Object.defineProperty(globalThis, 'BroadcastChannel', {
    configurable: true,
    value: class {
      postMessage(message: { type: string }) {
        messages.push(message);
      }
      close() {}
    },
  });
  const mock = t.mock.method(globalThis, 'fetch', async (url: string, init?: RequestInit) => {
    assert.equal(url, '/next-api/auth/password-reset');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.credentials, 'same-origin');
    assert.deepEqual(JSON.parse(init?.body as string), input);
    return Response.json({ success: true });
  });
  assert.deepEqual(await resetPasswordAndSignOut(input), { success: true });
  assert.equal(useAuthStore.getState().status, 'anonymous');
  assert.equal(useAuthStore.getState().accountOwnerId, null);
  assert.equal(useUserMainProfileStore.getState().userMainProfile, null);
  assert.ok(!Object.keys(useEditUserMainProfileStore.getState().userEditData ?? {}).length);
  assert.ok(getAuthGeneration() > generation);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, 'logout');
  assert.equal(mock.mock.callCount(), 1);
});

test('failed or unconfirmed reset leaves the current browser identity and draft intact', async (t) => {
  signedIn(t);
  const generation = getAuthGeneration();
  for (const failure of ['rejected', 'network', 'malformed']) {
    const mock = t.mock.method(globalThis, 'fetch', async () => {
      if (failure === 'network') throw new Error('offline');
      if (failure === 'malformed') return new Response('<html>Bad gateway</html>', { status: 502 });
      return Response.json({ success: false, error: 'Code not accepted.' }, { status: 400 });
    });
    const result = await resetPasswordAndSignOut(input);
    assert.equal(result.success, false);
    assert.equal(useAuthStore.getState().isAuthenticated, true);
    assert.equal(useAuthStore.getState().accountOwnerId, 'reset-user');
    assert.deepEqual(useEditUserMainProfileStore.getState().userEditData, {
      first_name: 'Unsaved',
    });
    assert.equal(getAuthGeneration(), generation);
    mock.mock.restore();
  }
});

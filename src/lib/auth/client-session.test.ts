import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearPrivateClientState,
  getAuthClientId,
  isGuestSession,
  publishSessionChange,
} from './client-session';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { useDjangoOrderIntentStore } from '@/stores/shop_stores/checkoutStore/djangoOrderIntentStore';

test('HTTP LAN tabs without secure-context UUID support still publish stable auth notifications', (t) => {
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  const channelDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'BroadcastChannel');
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  t.after(() => {
    for (const [key, descriptor] of [
      ['crypto', cryptoDescriptor],
      ['BroadcastChannel', channelDescriptor],
      ['window', windowDescriptor],
    ] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });

  // Insecure LAN origins expose crypto without randomUUID, unlike localhost/HTTPS.
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {} });
  const messages: Array<{ type: string; source: string }> = [];
  Object.defineProperty(globalThis, 'BroadcastChannel', {
    configurable: true,
    value: class {
      postMessage(message: { type: string; source: string }) {
        messages.push(message);
      }
      close() {}
    },
  });
  const clientId = getAuthClientId();
  assert.ok(clientId.length > 8);
  assert.equal(getAuthClientId(), clientId);
  publishSessionChange('login');
  assert.equal(messages.length, 1);
  assert.equal(messages[0].source, clientId);
  assert.equal(messages[0].type, 'login');

  Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: undefined });
  const stored = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: { setItem: (key: string, value: string) => stored.set(key, value) } },
  });
  publishSessionChange('logout');
  const fallback = JSON.parse(stored.get('codex-auth-event')!);
  assert.equal(fallback.source, clientId);
  assert.equal(fallback.type, 'logout');
});

test('only an established guest session can continue checkout through sign-in', () => {
  assert.equal(isGuestSession({ accountOwnerId: null, status: 'anonymous' }), true);
  for (const status of ['unknown', 'unavailable', 'authenticated'])
    assert.equal(isGuestSession({ accountOwnerId: null, status }), false);
  assert.equal(isGuestSession({ accountOwnerId: 'account-a', status: 'anonymous' }), false);
});

test('guest sign-in keeps delivery and verification, while normal account cleanup clears them', async () => {
  useShopCheckoutStore.getState().setEmail('guest@example.test');
  useDjangoOrderIntentStore
    .getState()
    .setDjangoOrderIntent({ djangoOrderIntentOrderId: 'guest-order' });
  await clearPrivateClientState({ preserveGuestCheckout: true });
  assert.equal(useShopCheckoutStore.getState().email, 'guest@example.test');
  assert.equal(useDjangoOrderIntentStore.getState().djangoOrderIntentOrderId, 'guest-order');
  await clearPrivateClientState();
  assert.equal(useShopCheckoutStore.getState().email, '');
  assert.equal(useDjangoOrderIntentStore.getState().djangoOrderIntentOrderId, '');
});

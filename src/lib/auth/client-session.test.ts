import assert from 'node:assert/strict';
import test from 'node:test';
import { getAuthClientId, publishSessionChange } from './client-session';

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

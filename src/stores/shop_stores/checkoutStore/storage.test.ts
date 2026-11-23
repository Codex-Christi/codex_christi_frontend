import assert from 'node:assert/strict';
import test from 'node:test';
import { CART_KEY_FIXTURE, deferred, MemoryLegacyStorage } from '@/lib/cart/test-support';
import {
  clearLegacyCheckoutCaches,
  createCheckoutObfuscatedStorage,
  flushCheckoutStorage,
  getCheckoutStorageIssues,
  retryCheckoutStorage,
} from './storage';
import { obfuscateBrowserText } from '@/lib/crypto/browserObfuscatedStorage';

const value = { state: { orderToken: 'order-one' }, version: 0 };
const getCartKey = async () => CART_KEY_FIXTURE;

test('obsolete verification caches are removed without deleting the active checkout', async () => {
  const storage = new MemoryLegacyStorage();
  for (const name of ['paid-checkout-recovery-store', 'verifiedEmailsList-emails']) {
    for (const suffix of ['', ':v2', ':recovery']) storage.setItem(`${name}${suffix}`, 'old');
  }
  storage.setItem('django-order-intent-store:v2', JSON.stringify(value));
  await clearLegacyCheckoutCaches({ getStorage: () => storage });
  assert.equal(storage.size, 1);
  assert.equal(storage.getItem('django-order-intent-store:v2'), JSON.stringify(value));
});

test('HTTP LAN checkout state survives reload without Web Crypto while old encrypted records remain safe', async () => {
  const storage = new MemoryLegacyStorage();
  storage.setItem('lan-test', 'ob1.existing-original-ciphertext');
  const options = { getStorage: () => storage, cryptoAvailable: () => false };
  const adapter = createCheckoutObfuscatedStorage<typeof value.state>(
    'lan-test',
    undefined,
    options,
  );
  await adapter.setItem('lan-test', value);
  assert.equal(storage.getItem('lan-test'), 'ob1.existing-original-ciphertext');
  const reload = createCheckoutObfuscatedStorage<typeof value.state>(
    'lan-test',
    undefined,
    options,
  );
  assert.deepEqual(await reload.getItem('lan-test'), value);
});

test('unavailable decryption and malformed checkout state are preserved and reported rather than removed', async () => {
  const storage = new MemoryLegacyStorage();
  const original = 'ob1.invalid-encrypted-record';
  storage.setItem('broken-test', original);
  const adapter = createCheckoutObfuscatedStorage('broken-test', undefined, {
    getStorage: () => storage,
    getCartKey,
  });
  assert.equal(await adapter.getItem('broken-test'), null);
  assert.equal(storage.getItem('broken-test'), original);
  assert.equal(
    getCheckoutStorageIssues().find((item) => item.purpose === 'broken-test')?.severity,
    'warning',
  );
  storage.setItem('broken-test:v2', '{"state":null}');
  assert.equal(await adapter.getItem('broken-test'), null);
  assert.equal(storage.getItem('broken-test:v2'), '{"state":null}');
});

test('a storage outage reports unsaved checkout and flush blocks payment setup until a successful retry', async () => {
  const storage = new MemoryLegacyStorage();
  let failed = true;
  const adapter = createCheckoutObfuscatedStorage('outage-test', undefined, {
    getStorage: () => {
      if (failed) throw new Error('quota');
      return storage;
    },
    cryptoAvailable: () => false,
  });
  await adapter.setItem('outage-test', value);
  await assert.rejects(flushCheckoutStorage('outage-test'), /could not be saved/);
  failed = false;
  await adapter.setItem('outage-test', value);
  await flushCheckoutStorage('outage-test');
  assert.deepEqual(await adapter.getItem('outage-test'), value);
});

test('clearing checkout waits for queued writes and removes every owned record', async () => {
  const storage = new MemoryLegacyStorage();
  storage.setItem('clear-test', 'original');
  storage.setItem('clear-test:recovery', 'recovery');
  const adapter = createCheckoutObfuscatedStorage('clear-test', undefined, {
    getStorage: () => storage,
    getCartKey,
  });
  const write = adapter.setItem('clear-test', value);
  const removal = adapter.removeItem('clear-test');
  await Promise.all([write, removal]);
  assert.equal(storage.size, 0);
  assert.equal(await adapter.getItem('clear-test'), null);
});

test('a current encrypted record has a recovery copy before an HTTP-compatible write replaces it', async () => {
  const storage = new MemoryLegacyStorage();
  const encrypted = await obfuscateBrowserText(
    JSON.stringify(value),
    CART_KEY_FIXTURE,
    'fallback-test',
  );
  storage.setItem('fallback-test:v2', encrypted);
  const adapter = createCheckoutObfuscatedStorage('fallback-test', undefined, {
    getStorage: () => storage,
    cryptoAvailable: () => false,
  });
  assert.equal(await adapter.getItem('fallback-test'), null);
  assert.equal(storage.getItem('fallback-test:v2'), encrypted);
  await adapter.setItem('fallback-test', value);
  assert.equal(storage.getItem('fallback-test:recovery'), encrypted);
  assert.deepEqual(await adapter.getItem('fallback-test'), value);
});

test('reading an older saved checkout cannot dismiss a failed newer write or unblock payment setup', async () => {
  const storage = new MemoryLegacyStorage();
  storage.set('quota-test:v2', JSON.stringify(value));
  let full = true;
  storage.setItem = (key, saved) => {
    if (full) throw new Error('quota');
    storage.set(key, saved);
  };
  const adapter = createCheckoutObfuscatedStorage('quota-test', undefined, {
    getStorage: () => storage,
    cryptoAvailable: () => false,
  });
  await adapter.setItem('quota-test', { state: { orderToken: 'newer-order' }, version: 0 });
  assert.deepEqual(await adapter.getItem('quota-test'), value);
  await assert.rejects(flushCheckoutStorage('quota-test'), /could not be saved/);
  full = false;
  await adapter.setItem('quota-test', { state: { orderToken: 'newer-order' }, version: 0 });
  await flushCheckoutStorage('quota-test');
});

test('retrying recovered storage persists the same unchanged payment attempt after its first write failed', async (t) => {
  const { beginCheckoutAttempt, usePayPalIntentStore } = await import('./paypalIntentStore');
  const originalOptions = usePayPalIntentStore.persist.getOptions();
  t.after(() => usePayPalIntentStore.persist.setOptions(originalOptions));
  const storage = new MemoryLegacyStorage();
  storage.setItem('retry-attempt', 'ob1.original-recovery-copy');
  let unavailable = true;
  type SavedAttempt = Pick<
    ReturnType<typeof usePayPalIntentStore.getState>,
    'orderToken' | 'checkoutAttempt' | 'activeCheckout'
  >;
  const adapter = createCheckoutObfuscatedStorage<SavedAttempt>('retry-attempt', undefined, {
    getStorage: () => {
      if (unavailable) throw new Error('quota');
      return storage;
    },
    cryptoAvailable: () => false,
  });
  usePayPalIntentStore.persist.setOptions({ name: 'retry-attempt', storage: adapter });
  const attempt = beginCheckoutAttempt('unchanged-details');
  await assert.rejects(flushCheckoutStorage('retry-attempt'), /could not be saved/);
  unavailable = false;
  assert.equal(beginCheckoutAttempt('unchanged-details').attemptId, attempt.attemptId);
  await assert.rejects(flushCheckoutStorage('retry-attempt'), /could not be saved/);
  await retryCheckoutStorage('retry-attempt');
  const saved = (await adapter.getItem('retry-attempt')) as {
    state: { checkoutAttempt: { attemptId: string } };
  };
  assert.equal(saved.state.checkoutAttempt.attemptId, attempt.attemptId);
  assert.equal(storage.getItem('retry-attempt'), 'ob1.original-recovery-copy');
});

test('storage retry replays the latest removal rather than resurrecting an earlier failed write', async () => {
  const storage = new MemoryLegacyStorage();
  storage.setItem('retry-removal:v2', JSON.stringify(value));
  let unavailable = true;
  const adapter = createCheckoutObfuscatedStorage('retry-removal', undefined, {
    getStorage: () => {
      if (unavailable) throw new Error('quota');
      return storage;
    },
    cryptoAvailable: () => false,
  });
  await adapter.setItem('retry-removal', { state: { orderToken: 'stale-new-order' }, version: 0 });
  await adapter.removeItem('retry-removal');
  await assert.rejects(retryCheckoutStorage('retry-removal'), /could not be saved/);
  unavailable = false;
  await retryCheckoutStorage('retry-removal');
  assert.equal(storage.getItem('retry-removal:v2'), null);
  assert.equal(await adapter.getItem('retry-removal'), null);
});

test('a runtime key outage leaves the saved checkout untouched until a write can be retried', async () => {
  const storage = new MemoryLegacyStorage();
  const purpose = 'runtime-write-retry';
  const original = await obfuscateBrowserText(JSON.stringify(value), CART_KEY_FIXTURE, purpose);
  storage.setItem(`${purpose}:v2`, original);
  let unavailable = true;
  const adapter = createCheckoutObfuscatedStorage(purpose, undefined, {
    getStorage: () => storage,
    getCartKey: async () => {
      if (unavailable) throw new Error('Runtime configuration unavailable.');
      return CART_KEY_FIXTURE;
    },
  });
  const updated = { state: { orderToken: 'order-two' }, version: 0 };
  await adapter.setItem(purpose, updated);
  await assert.rejects(flushCheckoutStorage(purpose), /could not be saved/);
  assert.equal(storage.getItem(`${purpose}:v2`), original);
  assert.equal(storage.getItem(`${purpose}:recovery`), null);
  unavailable = false;
  await retryCheckoutStorage(purpose);
  assert.deepEqual(await adapter.getItem(purpose), updated);
});

test('failed runtime config during checkout restoration blocks payment and new writes until reload', async () => {
  const storage = new MemoryLegacyStorage();
  const purpose = 'runtime-read-reload';
  const original = await obfuscateBrowserText(JSON.stringify(value), CART_KEY_FIXTURE, purpose);
  storage.setItem(`${purpose}:v2`, original);
  let unavailable = true;
  const adapter = createCheckoutObfuscatedStorage(purpose, undefined, {
    getStorage: () => storage,
    getCartKey: async () => {
      if (unavailable) throw new Error('Runtime configuration unavailable.');
      return CART_KEY_FIXTURE;
    },
  });
  assert.equal(await adapter.getItem(purpose), null);
  assert.equal(getCheckoutStorageIssues().find((issue) => issue.purpose === purpose)?.recovery, 'reload');
  unavailable = false;
  await adapter.setItem(purpose, { state: { orderToken: 'new-order' }, version: 0 });
  await assert.rejects(retryCheckoutStorage(purpose), /Reload this page before paying/);
  await assert.rejects(flushCheckoutStorage('paypal-intent-store'), /Reload this page before paying/);
  assert.equal(storage.getItem(`${purpose}:v2`), original);
  assert.equal(storage.getItem(`${purpose}:recovery`), null);

  // A new page receives the configured key and can restore the original attempt.
  const reloaded = createCheckoutObfuscatedStorage(purpose, undefined, {
    getStorage: () => storage,
    getCartKey,
  });
  assert.deepEqual(await reloaded.getItem(purpose), value);
  // Explicit sign-out/state removal is still allowed even after a failed restore.
  await adapter.removeItem(purpose);
  await flushCheckoutStorage(purpose);
  assert.equal(storage.getItem(`${purpose}:v2`), null);
});

test('a failed runtime restore also protects the original from a concurrent queued write', async () => {
  const storage = new MemoryLegacyStorage();
  const purpose = 'runtime-read-race';
  const original = await obfuscateBrowserText(JSON.stringify(value), CART_KEY_FIXTURE, purpose);
  storage.setItem(`${purpose}:v2`, original);
  const started = deferred();
  const gate = deferred<string>();
  const adapter = createCheckoutObfuscatedStorage(purpose, undefined, {
    getStorage: () => storage,
    getCartKey: async () => {
      started.resolve();
      return gate.promise;
    },
  });
  const read = adapter.getItem(purpose);
  await started.promise;
  const write = adapter.setItem(purpose, { state: { orderToken: 'new-order' }, version: 0 });
  gate.resolve(Promise.reject(new Error('Runtime configuration unavailable.')));
  await Promise.all([read, write]);
  await assert.rejects(flushCheckoutStorage(purpose), /Reload this page before paying/);
  assert.equal(storage.getItem(`${purpose}:v2`), original);
  await adapter.removeItem(purpose);
});

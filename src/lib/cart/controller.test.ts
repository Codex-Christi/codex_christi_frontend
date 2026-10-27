import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { CartController, type CartView } from './controller';
import { projectCart, reconcileCart } from './model';
import { CartTransportError } from './transport';
import type { CartVariant } from './types';
import {
  cartLine,
  deferred,
  MemoryCartDriver,
  MemoryLegacyStorage,
  memoryRepository,
} from './test-support';

function fixture(
  t: TestContext,
  driver = new MemoryCartDriver(),
  legacy = new MemoryLegacyStorage(),
) {
  const repository = memoryRepository(driver, legacy);
  const views: CartView[] = [];
  const references: CartView[] = [];
  const remote = new Map<string, CartVariant[]>();
  const writes: { owner: string; action: string; line: CartVariant }[] = [];
  let online = false;
  let readCount = 0;
  const transport = {
    read: async (owner: string) => {
      readCount += 1;
      return structuredClone(remote.get(owner) ?? []);
    },
    write: async (owner: string, action: 'add' | 'update' | 'remove', line: CartVariant) => {
      writes.push({ owner, action, line: structuredClone(line) });
      const items = remote.get(owner) ?? [];
      remote.set(
        owner,
        action === 'remove'
          ? items.filter((item) => item.variantId !== line.variantId)
          : [...items.filter((item) => item.variantId !== line.variantId), structuredClone(line)],
      );
    },
  };
  const controller = new CartController(
    repository,
    (view) => {
      views.push(structuredClone(view));
      references.push(view);
    },
    transport,
    () => online,
  );
  t.after(() => controller.dispose());
  return {
    controller,
    repository,
    driver,
    views,
    transport,
    remote,
    writes,
    current: () => views.at(-1)!,
    currentReference: () => references.at(-1)!,
    references,
    connected: (value = true) => {
      online = value;
    },
    readCount: () => readCount,
  };
}

test('an early command waits for activation and hydration before extending an existing saved cart', async (t) => {
  const driver = new MemoryCartDriver();
  const legacy = new MemoryLegacyStorage();
  legacy.setItem('cart-storage', JSON.stringify({ state: { variants: [cartLine('saved', 2)] } }));
  const gate = deferred();
  let delayed = false;
  driver.beforeRun = async () => {
    if (!delayed) {
      delayed = true;
      await gate.promise;
    }
  };
  const f = fixture(t, driver, legacy);
  const command = f.controller.command({ type: 'add', line: cartLine('new') });
  const activation = f.controller.activate('guest', false);
  gate.resolve();
  await Promise.all([activation, command]);
  assert.deepEqual(
    f.current().variants.map((line) => [line.variantId, line.quantity]),
    [
      ['saved', 2],
      ['new', 1],
    ],
  );
  assert.equal(f.current().hydrated, true);
});

test('sign-in imports guest quantities once and logout exposes a separate guest cart', async (t) => {
  const f = fixture(t);
  await f.controller.activate('guest', false);
  await f.controller.command({ type: 'add', line: cartLine('shirt-m', 2) });
  f.remote.set('alice', [cartLine('shirt-m', 3)]);
  await f.controller.activate('user:alice', true);
  f.connected();
  await f.controller.sync();
  assert.equal(f.current().variants[0].quantity, 5);
  assert.equal(f.remote.get('alice')?.[0].quantity, 5);
  assert.equal(f.writes.length, 1);
  f.connected(false);
  await f.controller.activate('guest', false);
  assert.deepEqual(f.current().variants, []);
  await f.controller.activate('user:alice', true);
  f.connected();
  await f.controller.sync();
  assert.equal(f.current().variants[0].quantity, 5);
  assert.equal(f.writes.length, 1);
});

test('unchanged storage, remote, and status refreshes retain the projected line references', async (t) => {
  const f = fixture(t);
  await f.repository.update('user:alice', (document) =>
    reconcileCart(document, [cartLine('shirt-m', 3)]),
  );
  f.remote.set('alice', [cartLine('shirt-m', 3)]);
  await f.controller.activate('user:alice', true);
  const original = f.currentReference().variants;
  const start = f.references.length;
  await f.controller.refresh();
  f.connected();
  await f.controller.sync();
  f.connected(false);
  f.controller.schedule(0);
  assert.ok(f.references.slice(start).length > 2);
  assert.ok(f.references.slice(start).every((view) => view.variants === original));
  assert.equal(f.currentReference().variants[0], original[0]);
  assert.equal(f.writes.length, 0);
});

test('a clean account silently adopts remote quantities and metadata, without sharing references across accounts', async (t) => {
  const f = fixture(t);
  await f.repository.update('user:alice', (document) =>
    reconcileCart(document, [cartLine('shirt-m', 3)]),
  );
  await f.controller.activate('user:alice', true);
  const initial = f.currentReference().variants;
  f.remote.set('alice', [cartLine('shirt-m', 4)]);
  f.connected();
  await f.controller.sync();
  const changedQuantity = f.currentReference().variants;
  assert.notEqual(changedQuantity, initial);
  assert.equal(changedQuantity[0].quantity, 4);
  assert.equal(f.current().conflicts.length, 0);
  assert.equal(f.writes.length, 0);

  const updated = cartLine('shirt-m', 4);
  updated.itemDetail.retail_price = 29;
  updated.itemDetail.image_uris = ['https://mainmedia.codexchristi.org/new-shirt.jpg'];
  f.remote.set('alice', [updated]);
  await f.controller.sync();
  const changedMetadata = f.currentReference().variants;
  assert.notEqual(changedMetadata, changedQuantity);
  assert.equal(changedMetadata[0].itemDetail.retail_price, 29);
  assert.equal(f.current().conflicts.length, 0);
  f.connected(false);
  await f.repository.update('user:bob', (document) => reconcileCart(document, [updated]));
  await f.controller.activate('user:bob', true);
  assert.deepEqual(f.currentReference().variants, changedMetadata);
  assert.notEqual(f.currentReference().variants, changedMetadata);
  assert.notEqual(f.currentReference().variants[0], changedMetadata[0]);
});

test('offline removals remain tombstones through reload and remove the remote item on reconnect', async (t) => {
  const f = fixture(t);
  await f.repository.update('user:alice', (document) =>
    reconcileCart(document, [cartLine('shirt-m', 3)]),
  );
  f.remote.set('alice', [cartLine('shirt-m', 3)]);
  await f.controller.activate('user:alice', true);
  await f.controller.command({ type: 'remove', variantId: 'shirt-m' });
  const saved = await f.repository.read('user:alice');
  assert.equal(saved.edits['shirt-m'].quantity, 0);
  assert.deepEqual(f.current().variants, []);
  const reloaded = fixture(t, f.driver);
  reloaded.remote.set('alice', [cartLine('shirt-m', 3)]);
  await reloaded.controller.activate('user:alice', true);
  reloaded.connected();
  await reloaded.controller.sync();
  assert.deepEqual(reloaded.current().variants, []);
  assert.equal(reloaded.writes[0].action, 'remove');
  assert.deepEqual((await reloaded.repository.read('user:alice')).edits, {});
});

test('a newer local edit survives an in-flight write and is sent as its own successor', async (t) => {
  const f = fixture(t);
  await f.repository.update('user:alice', (document) => reconcileCart(document, [cartLine()]));
  f.remote.set('alice', [cartLine()]);
  await f.controller.activate('user:alice', true);
  await f.controller.command({ type: 'add', line: cartLine() });
  const firstStarted = deferred();
  const releaseFirst = deferred();
  const secondStarted = deferred();
  const releaseSecond = deferred();
  const write = f.transport.write;
  let calls = 0;
  f.transport.write = async (...args) => {
    calls += 1;
    if (calls === 1) {
      firstStarted.resolve();
      await releaseFirst.promise;
    } else {
      secondStarted.resolve();
      await releaseSecond.promise;
    }
    return write(...args);
  };
  f.connected();
  const syncing = f.controller.sync();
  await firstStarted.promise;
  await f.controller.command({ type: 'add', line: cartLine() });
  releaseFirst.resolve();
  await secondStarted.promise;
  const pending = await f.repository.read('user:alice');
  assert.equal(projectCart(pending)[0].quantity, 3);
  assert.equal(pending.edits['shirt-m'].baseQuantity, 2);
  releaseSecond.resolve();
  await syncing;
  assert.deepEqual(
    f.writes.map((write) => write.line.quantity),
    [2, 3],
  );
  assert.equal(f.current().variants[0].quantity, 3);
  assert.deepEqual((await f.repository.read('user:alice')).edits, {});
});

test('a response from account A cannot replace account B after the session switches', async (t) => {
  const f = fixture(t);
  await f.repository.update('user:alice', (document) => reconcileCart(document, [cartLine()]));
  await f.repository.update('user:bob', (document) =>
    reconcileCart(document, [cartLine('hat', 7)]),
  );
  await f.controller.activate('user:alice', true);
  await f.controller.command({ type: 'add', line: cartLine() });
  const started = deferred();
  const response = deferred<CartVariant[]>();
  f.transport.read = async () => {
    started.resolve();
    return response.promise;
  };
  f.connected();
  const syncing = f.controller.sync();
  await started.promise;
  f.connected(false);
  await f.controller.activate('user:bob', true);
  response.resolve([cartLine('shirt-m', 99)]);
  await syncing;
  assert.equal(f.current().owner, 'user:bob');
  assert.deepEqual(
    f.current().variants.map((line) => [line.variantId, line.quantity]),
    [['hat', 7]],
  );
  assert.equal(projectCart(await f.repository.read('user:alice'))[0].quantity, 2);
  assert.deepEqual(f.writes, []);
});

test('a command queued during account A activation cannot become an account B edit', async (t) => {
  const driver = new MemoryCartDriver();
  const gate = deferred();
  let delayed = false;
  driver.beforeRun = async () => {
    if (!delayed) {
      delayed = true;
      await gate.promise;
    }
  };
  const f = fixture(t, driver);
  const first = f.controller.activate('user:alice', true);
  const queued = f.controller.command({ type: 'add', line: cartLine() }).catch(() => undefined);
  const second = f.controller.activate('user:bob', true);
  gate.resolve();
  await Promise.all([first, second, queued]);
  assert.equal(f.current().owner, 'user:bob');
  assert.deepEqual(f.current().variants, []);
  assert.deepEqual(projectCart(await f.repository.read('user:bob')), []);
});

test('an uncertain add is not blindly replayed after a reconnect or controller reload', async (t) => {
  const f = fixture(t);
  await f.controller.activate('user:alice', true);
  await f.controller.command({ type: 'add', line: cartLine('shirt-m', 2) });
  let sends = 0;
  f.transport.write = async () => {
    sends += 1;
    throw new CartTransportError('The response was lost.', 0, true);
  };
  f.connected();
  await f.controller.sync();
  await f.controller.sync();
  assert.equal(sends, 1);
  assert.equal(f.current().syncStatus, 'uncertain');
  assert.equal(f.current().variants[0].quantity, 2);
  const reloaded = fixture(t, f.driver);
  await reloaded.controller.activate('user:alice', true);
  reloaded.connected();
  await reloaded.controller.sync();
  assert.equal(reloaded.writes.length, 0);
  assert.equal(reloaded.current().conflicts[0].uncertain, true);
});

test('a failed confirmation read cannot turn a successful add into a replayable operation', async (t) => {
  const f = fixture(t);
  await f.controller.activate('user:alice', true);
  await f.controller.command({ type: 'add', line: cartLine('shirt-m', 2) });
  let reads = 0;
  f.transport.read = async () => {
    reads += 1;
    if (reads === 2) throw new CartTransportError('Confirmation could not be loaded.', 502, false);
    // A stale read after a successful write must not authorize repeating an additive POST.
    return [];
  };
  f.connected();
  await f.controller.sync();
  await f.controller.sync();
  assert.equal(f.writes.length, 1);
  assert.equal(f.current().syncStatus, 'uncertain');
  assert.equal(f.current().variants[0].quantity, 2);
});

test('a confirmed write with an interrupted read is acknowledged after a matching later read', async (t) => {
  const f = fixture(t);
  await f.controller.activate('user:alice', true);
  await f.controller.command({ type: 'add', line: cartLine('shirt-m', 2) });
  const read = f.transport.read;
  let reads = 0;
  f.transport.read = async (...args) => {
    reads += 1;
    if (reads === 2) throw new CartTransportError('Readback disconnected.', 502, false);
    return read(...args);
  };
  f.connected();
  await f.controller.sync();
  assert.equal(f.current().syncStatus, 'uncertain');
  await f.controller.sync();
  assert.equal(f.current().syncStatus, 'synced');
  assert.equal(f.writes.length, 1);
  assert.deepEqual((await f.repository.read('user:alice')).flights, {});
});

test('same-item conflicts pause only that item while other pending changes continue syncing', async (t) => {
  const f = fixture(t);
  await f.repository.update('user:alice', (document) =>
    reconcileCart(document, [cartLine('shirt-m', 3)]),
  );
  await f.controller.activate('user:alice', true);
  await f.controller.command({ type: 'setQuantity', variantId: 'shirt-m', quantity: 2 });
  await f.controller.command({ type: 'add', line: cartLine('hat') });
  f.remote.set('alice', [cartLine('shirt-m', 4)]);
  f.connected();
  await f.controller.sync();
  assert.equal(f.current().conflicts.length, 1);
  assert.equal(f.current().conflicts[0].localQuantity, 2);
  assert.equal(f.current().conflicts[0].remoteQuantity, 4);
  assert.deepEqual(
    f.writes.map((write) => write.line.variantId),
    ['hat'],
  );
  f.connected(false);
  await f.controller.resolveConflict('shirt-m', 'local');
  f.connected();
  await f.controller.sync();
  assert.equal(f.remote.get('alice')?.find((line) => line.variantId === 'shirt-m')?.quantity, 2);
  assert.equal(f.current().conflicts.length, 0);
});

test('paid quantities are capped by the captured checkout and consumed only once', async (t) => {
  const f = fixture(t);
  await f.controller.activate('guest', false);
  await f.controller.command({ type: 'add', line: cartLine('shirt-m', 2) });
  await f.controller.recordCheckout('order-one', f.controller.checkoutSnapshot());
  await f.controller.command({ type: 'add', line: cartLine('shirt-m', 3) });
  await f.controller.command({ type: 'add', line: cartLine('hat', 4) });
  const paid = [
    { variantId: 'shirt-m', quantity: 999 },
    { variantId: 'hat', quantity: 4 },
  ];
  await f.controller.consumePurchase('order-one', paid);
  assert.deepEqual(
    f.current().variants.map((line) => [line.variantId, line.quantity]),
    [
      ['shirt-m', 3],
      ['hat', 4],
    ],
  );
  await f.controller.consumePurchase('order-one', paid);
  assert.equal(f.current().variants[0].quantity, 3);
  await f.controller.consumePurchase('unknown-legacy-order', [{ variantId: 'hat', quantity: 4 }]);
  assert.equal(f.current().variants[1].quantity, 4);
});

test('purchase cleanup preserves a removed and re-added line and never consumes another account cart', async (t) => {
  const f = fixture(t);
  await f.controller.activate('user:alice', true);
  await f.controller.command({ type: 'add', line: cartLine('shirt-m', 2) });
  await f.controller.recordCheckout('order-one', f.controller.checkoutSnapshot());
  await f.controller.command({ type: 'remove', variantId: 'shirt-m' });
  await f.controller.command({ type: 'add', line: cartLine() });
  await f.controller.activate('user:bob', true);
  await f.controller.command({ type: 'add', line: cartLine('hat', 7) });
  await f.controller.consumePurchase('order-one', [{ variantId: 'shirt-m', quantity: 2 }]);
  assert.equal(f.current().owner, 'user:bob');
  assert.equal(f.current().variants[0].quantity, 7);
  assert.equal(projectCart(await f.repository.read('user:alice'))[0].quantity, 1);
});

test('storage failure is reported as memory-only and prevents remote uploads until recovery', async (t) => {
  const driver = new MemoryCartDriver();
  driver.fail = true;
  const f = fixture(t, driver);
  await f.controller.activate('user:alice', true);
  await f.controller.command({ type: 'add', line: cartLine('shirt-m', 2) });
  assert.equal(f.current().variants[0].quantity, 2);
  assert.ok(f.current().storageError, 'a storage failure must remain visible to the UI');
  f.connected();
  await f.controller.sync();
  assert.equal(f.readCount(), 0);
  assert.deepEqual(f.writes, []);
  driver.fail = false;
  await f.controller.retry();
  assert.equal(f.current().storageError, null);
  assert.equal(f.remote.get('alice')?.[0].quantity, 2);
  assert.equal(f.writes.length, 1);
});

test('recovering storage merges a new guest contribution with a previously unreadable saved cart', async (t) => {
  const driver = new MemoryCartDriver();
  const legacy = new MemoryLegacyStorage();
  legacy.setItem('cart-storage', JSON.stringify({ state: { variants: [cartLine('shirt-m', 2)] } }));
  driver.fail = true;
  const f = fixture(t, driver, legacy);
  await f.controller.activate('guest', false);
  await f.controller.command({ type: 'add', line: cartLine() });
  assert.equal(f.current().variants[0].quantity, 1);
  driver.fail = false;
  await f.controller.retry();
  assert.equal(f.current().storageError, null);
  assert.equal(f.current().variants[0].quantity, 3);
  assert.equal(projectCart(await f.repository.read('guest'))[0].quantity, 3);
});

test('an in-memory removal made during a storage outage is not resurrected after recovery', async (t) => {
  const driver = new MemoryCartDriver();
  const f = fixture(t, driver);
  await f.controller.activate('guest', false);
  await f.controller.command({ type: 'add', line: cartLine() });
  driver.fail = true;
  await f.controller.command({ type: 'remove', variantId: 'shirt-m' });
  assert.deepEqual(f.current().variants, []);
  driver.fail = false;
  await f.controller.retry();
  assert.deepEqual(f.current().variants, []);
  assert.deepEqual(projectCart(await f.repository.read('guest')), []);
});

test('guest purchase bindings follow sign-in, consume only transferred quantities, and survive reload', async (t) => {
  const f = fixture(t);
  await f.repository.update('user:alice', (document) =>
    reconcileCart(document, [cartLine('shirt-m', 3)]),
  );
  await f.controller.activate('guest', false);
  await f.controller.command({ type: 'add', line: cartLine('shirt-m', 2) });
  await f.controller.recordCheckout('guest-order', f.controller.checkoutSnapshot());
  await f.controller.command({ type: 'setQuantity', variantId: 'shirt-m', quantity: 1 });
  await f.controller.activate('user:alice', true);
  assert.equal(f.current().variants[0].quantity, 4);
  assert.equal(await f.repository.purchaseOwner('guest-order'), 'user:alice');
  await f.controller.command({ type: 'add', line: cartLine('shirt-m', 2) });
  await f.controller.consumePurchase('guest-order', [{ variantId: 'shirt-m', quantity: 2 }]);
  assert.equal(f.current().variants[0].quantity, 5);
  await f.controller.consumePurchase('guest-order', [{ variantId: 'shirt-m', quantity: 2 }]);
  assert.equal(f.current().variants[0].quantity, 5);
  assert.equal(projectCart(await memoryRepository(f.driver).read('user:alice'))[0].quantity, 5);
});

test('a guest checkout response arriving after sign-in records its original snapshot in the adopted cart', async (t) => {
  const f = fixture(t);
  await f.controller.activate('guest', false);
  await f.controller.command({ type: 'add', line: cartLine('shirt-m', 2) });
  const captured = f.controller.checkoutSnapshot();
  await f.controller.activate('user:alice', true);
  await f.controller.command({ type: 'add', line: cartLine('shirt-m', 3) });
  await f.controller.recordCheckout('late-guest-order', captured);
  await f.controller.consumePurchase('late-guest-order', [{ variantId: 'shirt-m', quantity: 2 }]);
  assert.equal(f.current().variants[0].quantity, 3);
});

test('guest adoption does not let an older checkout consume a removed and re-added item or account items', async (t) => {
  const f = fixture(t);
  await f.repository.update('user:alice', (document) =>
    reconcileCart(document, [cartLine('shirt-m', 3)]),
  );
  await f.controller.activate('guest', false);
  await f.controller.command({ type: 'add', line: cartLine('shirt-m', 2) });
  await f.controller.recordCheckout('old-guest-order', f.controller.checkoutSnapshot());
  await f.controller.command({ type: 'remove', variantId: 'shirt-m' });
  await f.controller.command({ type: 'add', line: cartLine('shirt-m', 1) });
  await f.controller.activate('user:alice', true);
  await f.controller.consumePurchase('old-guest-order', [{ variantId: 'shirt-m', quantity: 2 }]);
  assert.equal(f.current().variants[0].quantity, 4);
});

test('purchase cleanup follows a concurrent adoption in another tab instead of consuming the replacement guest cart', async (t) => {
  const driver = new MemoryCartDriver();
  const guest = fixture(t, driver);
  const signedInTab = fixture(t, driver);
  await guest.controller.activate('guest', false);
  await guest.controller.command({ type: 'add', line: cartLine('shirt-m', 2) });
  await guest.controller.recordCheckout('adoption-race', guest.controller.checkoutSnapshot());
  const ownerRead = deferred();
  const release = deferred();
  let gated = false;
  driver.beforeRun = async (keys) => {
    if (!gated && keys.includes('purchase-owner:adoption-race')) {
      gated = true;
      ownerRead.resolve();
      await release.promise;
    }
  };
  const consuming = guest.controller.consumePurchase('adoption-race', [
    { variantId: 'shirt-m', quantity: 2 },
  ]);
  await ownerRead.promise;
  const adoption = signedInTab.controller.activate('user:alice', true);
  release.resolve();
  await Promise.all([consuming, adoption]);
  assert.deepEqual(projectCart(await guest.repository.read('user:alice')), []);
  assert.deepEqual(projectCart(await guest.repository.read('guest')), []);
});

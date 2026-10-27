import assert from 'node:assert/strict';
import test from 'node:test';
import { obfuscateBrowserText } from '@/lib/crypto/browserObfuscatedStorage';
import {
  consumeCartPurchase,
  createCartDocument,
  editCart,
  projectCart,
  reconcileCart,
} from './model';
import { CartRepository } from './repository';
import {
  cartLine,
  deferred,
  MemoryCartDriver,
  MemoryLegacyStorage,
  memoryRepository,
} from './test-support';

test('legacy carts migrate once across repository instances while preserving their recovery copy', async () => {
  const driver = new MemoryCartDriver();
  const legacy = new MemoryLegacyStorage();
  const original = await obfuscateBrowserText(
    JSON.stringify({
      state: { variants: [cartLine('shirt-m', 2), { quantity: 'damaged' }] },
      version: 0,
    }),
    process.env.NEXT_PUBLIC_CART_KEY || 'fallback-secret',
    'cart-storage',
  );
  legacy.setItem('cart-storage', original);
  const repository = memoryRepository(driver, legacy);
  assert.equal(projectCart(await repository.read('guest'))[0].quantity, 2);
  await repository.update('guest', (document) =>
    editCart(document, { type: 'add', line: cartLine('hat') }, 'add-hat'),
  );
  const reloaded = memoryRepository(driver, legacy);
  assert.deepEqual(
    projectCart(await reloaded.read('guest')).map((line) => [line.variantId, line.quantity]),
    [
      ['shirt-m', 2],
      ['hat', 1],
    ],
  );
  assert.equal(legacy.getItem('cart-storage'), original);
});

test('a decryption failure preserves the original instead of recording a completed migration', async () => {
  const driver = new MemoryCartDriver();
  const legacy = new MemoryLegacyStorage();
  legacy.setItem('cart-storage', 'ob1.unreadable.ciphertext');
  await assert.rejects(memoryRepository(driver, legacy).read('guest'), /original copy is safe/);
  assert.equal(legacy.getItem('cart-storage'), 'ob1.unreadable.ciphertext');
  assert.equal(driver.records.has('migration:cart-storage:v1'), false);
  assert.equal(driver.records.has('cart:guest'), false);
});

test('transactions combine independent tab edits and same-item increments from fresh stored state', async () => {
  const driver = new MemoryCartDriver();
  const firstTab = memoryRepository(driver);
  const secondTab = memoryRepository(driver);
  await Promise.all([firstTab.read('guest'), secondTab.read('guest')]);
  await Promise.all([
    firstTab.update('guest', (document) =>
      editCart(document, { type: 'add', line: cartLine() }, 'first'),
    ),
    secondTab.update('guest', (document) =>
      editCart(document, { type: 'add', line: cartLine('hat', 2) }, 'second'),
    ),
  ]);
  await Promise.all([
    firstTab.update('guest', (document) =>
      editCart(document, { type: 'add', line: cartLine() }, 'third'),
    ),
    secondTab.update('guest', (document) =>
      editCart(document, { type: 'add', line: cartLine() }, 'fourth'),
    ),
  ]);
  assert.deepEqual(
    projectCart(await firstTab.read('guest')).map((line) => [line.variantId, line.quantity]),
    [
      ['shirt-m', 3],
      ['hat', 2],
    ],
  );
});

test('concurrent sign-in adoption combines guest quantities once and atomically creates a fresh guest cart', async () => {
  const driver = new MemoryCartDriver();
  const firstTab = memoryRepository(driver);
  const secondTab = memoryRepository(driver);
  await firstTab.update('user:alice', (document) =>
    reconcileCart(document, [cartLine('shirt-m', 3)]),
  );
  await firstTab.update('guest', (document) =>
    editCart(document, { type: 'add', line: cartLine('shirt-m', 2) }, 'guest'),
  );
  const guestId = (await firstTab.read('guest')).cartId;
  await Promise.all([firstTab.adoptGuest('user:alice'), secondTab.adoptGuest('user:alice')]);
  const account = await firstTab.read('user:alice');
  assert.equal(projectCart(account)[0].quantity, 5);
  assert.deepEqual(account.importedGuestIds, [guestId]);
  const guest = await firstTab.read('guest');
  assert.notEqual(guest.cartId, guestId);
  assert.deepEqual(projectCart(guest), []);
  assert.equal(projectCart(await secondTab.adoptGuest('user:alice'))[0].quantity, 5);
});

test('account carts remain isolated and malformed stored documents are preserved for recovery', async () => {
  const driver = new MemoryCartDriver();
  const repository = memoryRepository(driver);
  await repository.update('user:alice', (document) =>
    editCart(document, { type: 'add', line: cartLine() }, 'alice'),
  );
  await repository.update('user:bob', (document) =>
    editCart(document, { type: 'add', line: cartLine('hat') }, 'bob'),
  );
  assert.equal(projectCart(await repository.read('user:alice'))[0].variantId, 'shirt-m');
  assert.equal(projectCart(await repository.read('user:bob'))[0].variantId, 'hat');
  const damaged = { ...createCartDocument('user:alice', 'saved'), version: 99 };
  driver.records.set('cart:user:alice', damaged);
  await assert.rejects(repository.read('user:alice'), /original copy has been preserved/);
  assert.deepEqual(driver.records.get('cart:user:alice'), damaged);
});

test('unchanged refreshes and duplicate purchase cleanup do not rewrite or announce the cart', async () => {
  const driver = new MemoryCartDriver();
  let announcements = 0;
  const repository = new CartRepository(
    driver,
    () => undefined,
    () => {
      announcements += 1;
    },
  );
  const original = await repository.update('user:alice', (document) =>
    reconcileCart(document, [cartLine('shirt-m', 3)]),
  );
  announcements = 0;
  const unchanged = await repository.update('user:alice', (document) =>
    reconcileCart(document, [cartLine('shirt-m', 3)]),
  );
  assert.equal(unchanged.revision, original.revision);
  assert.equal(announcements, 0);

  const purchased = [{ variantId: 'shirt-m', quantity: 1, lineage: original.lineage['shirt-m'] }];
  const consumed = await repository.update('user:alice', (document) =>
    consumeCartPurchase(document, 'order-one', purchased, () => 'consume'),
  );
  const repeated = await repository.update('user:alice', (document) =>
    consumeCartPurchase(document, 'order-one', purchased, () => 'duplicate'),
  );
  assert.equal(repeated.revision, consumed.revision);
  assert.equal(projectCart(repeated)[0].quantity, 2);
  assert.equal(announcements, 1);
});

test('empty account initialization has a stable stored identity without announcing an item change', async () => {
  const driver = new MemoryCartDriver();
  let announcements = 0;
  const repository = new CartRepository(
    driver,
    () => undefined,
    () => {
      announcements += 1;
    },
  );
  const adopted = await repository.adoptGuest('user:alice');
  assert.equal((await repository.read('user:alice')).cartId, adopted.cartId);
  assert.equal((await repository.adoptGuest('user:alice')).cartId, adopted.cartId);
  const untouched = await repository.update('user:bob', (document) => document);
  assert.equal((await repository.read('user:bob')).cartId, untouched.cartId);
  assert.equal(announcements, 0);
});

test('the IndexedDB lease serializes sync across tabs and releases after completion', async () => {
  const driver = new MemoryCartDriver();
  const firstTab = memoryRepository(driver);
  const secondTab = memoryRepository(driver);
  const started = deferred();
  const finish = deferred();
  const first = firstTab.withLease('user:alice', async (ownsLease) => {
    assert.equal(await ownsLease(), true);
    started.resolve();
    await finish.promise;
  });
  await started.promise;
  let overlapped = false;
  assert.equal(
    await secondTab.withLease('user:alice', async () => {
      overlapped = true;
    }),
    false,
  );
  assert.equal(overlapped, false);
  finish.resolve();
  assert.equal(await first, true);
  assert.equal(await secondTab.withLease('user:alice', async () => {}), true);
});

test('checkout ownership and captured lineages survive reload within their original account', async () => {
  const driver = new MemoryCartDriver();
  const repository = memoryRepository(driver);
  const document = await repository.update('user:alice', (document) =>
    editCart(document, { type: 'add', line: cartLine('shirt-m', 2) }, 'line-one'),
  );
  await repository.recordCheckout('order-one', {
    owner: document.owner,
    cartId: document.cartId,
    lines: projectCart(document).map((line) => ({
      variantId: line.variantId,
      quantity: line.quantity,
      lineage: document.lineage[line.variantId],
    })),
  });
  const reloaded = new CartRepository(driver, () => undefined);
  assert.equal(await reloaded.purchaseOwner('order-one'), 'user:alice');
  assert.equal(
    (await reloaded.read('user:alice')).checkoutSnapshots['order-one'].lines[0].lineage,
    'line-one',
  );
  assert.deepEqual((await reloaded.read('user:bob')).checkoutSnapshots, {});
});

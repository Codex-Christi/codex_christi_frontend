import assert from 'node:assert/strict';
import test from 'node:test';
import {
  consumeCartPurchase,
  createCartDocument,
  editCart,
  MAX_CART_QUANTITY,
  mergeGuestCart,
  normalizeCartDocument,
  normalizeCartLine,
  normalizeCartLines,
  projectCart,
  reconcileCart,
  resolveCartConflict,
  settleCartWrite,
} from './model';
import type { CartDocument, CartFlight, CartVariant } from './types';

function line(variantId = 'shirt-m', quantity = 1): CartVariant {
  return {
    variantId,
    quantity,
    title: 'Shirt',
    slug: 'shirt',
    itemDetail: {
      _id: variantId,
      title: 'Medium',
      product: 'shirt',
      sku: variantId,
      retail_price: 25,
      is_default: false,
      image_uris: [],
      options: [],
    },
  };
}

function account(lines: CartVariant[] = []) {
  return reconcileCart(createCartDocument('user:alice', 'account'), lines);
}

function quantity(document: CartDocument, variantId = 'shirt-m') {
  return projectCart(document).find((item) => item.variantId === variantId)?.quantity ?? 0;
}

function sending(document: CartDocument, kind: CartFlight['kind'] = 'update'): CartDocument {
  const edit = document.edits['shirt-m'];
  const flight: CartFlight = {
    editId: edit.id,
    variantId: 'shirt-m',
    quantity: edit.quantity,
    baseQuantity: edit.baseQuantity ?? 0,
    kind,
    phase: 'sending',
  };
  return { ...document, flights: { ...document.flights, 'shirt-m': flight } };
}

test('invalid quantities and mismatched variant metadata never enter the cart', () => {
  const guest = createCartDocument('guest', 'guest');
  for (const value of [-1, 0, 0.5, Number.NaN, Infinity, MAX_CART_QUANTITY + 1]) {
    assert.equal(normalizeCartLine(line('shirt-m', value)), null);
    assert.throws(() => editCart(guest, { type: 'add', line: line('shirt-m', value) }, 'edit'));
  }
  assert.equal(normalizeCartLine({ ...line(), variantId: '../shirt' }), null);
  for (const reserved of ['constructor', 'toString', '__proto__'])
    assert.equal(normalizeCartLine(line(reserved)), null);
  assert.equal(
    normalizeCartLine({ ...line(), itemDetail: { ...line().itemDetail, _id: 'other' } }),
    null,
  );
  const full = editCart(guest, { type: 'add', line: line('shirt-m', MAX_CART_QUANTITY) }, 'edit');
  assert.throws(() => editCart(full, { type: 'add', line: line() }, 'overflow'));
});

test('recovery keeps valid saved lines and coalesces duplicates without trusting arbitrary fields', () => {
  const recovered = normalizeCartLines([
    line('shirt-m', 2),
    { variantId: 'damaged', quantity: 1, itemDetail: null },
    { ...line('shirt-m', 3), injected: 'discard' },
    { ...line('hat'), itemDetail: { ...line('hat').itemDetail, retail_price: Number.NaN } },
  ]);
  assert.equal(recovered.length, 1);
  assert.equal(recovered[0].quantity, 5);
  assert.equal('injected' in recovered[0], false);
});

test('guest commands apply immediately and cancelling an unsent addition leaves no remote tombstone', () => {
  let guest = editCart(
    createCartDocument('guest', 'guest'),
    { type: 'add', line: line('shirt-m', 2) },
    'a',
  );
  guest = editCart(guest, { type: 'setQuantity', variantId: 'shirt-m', quantity: 1 }, 'b');
  assert.equal(quantity(guest), 1);
  guest = editCart(guest, { type: 'remove', variantId: 'shirt-m' }, 'c');
  assert.deepEqual(projectCart(guest), []);
  assert.deepEqual(guest.edits, {});
  assert.throws(() =>
    editCart(guest, { type: 'setQuantity', variantId: 'shirt-m', quantity: 2 }, 'd'),
  );
});

test('an addition before the first server read is combined once, not added on every refresh', () => {
  let document = editCart(
    createCartDocument('user:alice', 'account'),
    { type: 'add', line: line('shirt-m', 2) },
    'a',
  );
  assert.equal(quantity(document), 2);
  document = reconcileCart(document, [line('shirt-m', 3)]);
  assert.equal(quantity(document), 5);
  assert.equal(document.edits['shirt-m'].baseQuantity, 3);
  assert.equal(document.edits['shirt-m'].merge, undefined);
  document = reconcileCart(document, [line('shirt-m', 3)]);
  assert.equal(quantity(document), 5);
});

test('removing a pre-hydration contribution does not delete the unknown account cart', () => {
  let document = editCart(
    createCartDocument('user:alice', 'account'),
    { type: 'add', line: line('shirt-m', 2) },
    'a',
  );
  document = editCart(document, { type: 'remove', variantId: 'shirt-m' }, 'b');
  document = reconcileCart(document, [line('shirt-m', 3)]);
  assert.equal(quantity(document), 3);
  assert.deepEqual(document.edits, {});
});

test('remote refreshes retain pending decreases and removals instead of restoring larger quantities', () => {
  let document = account([line('shirt-m', 4), line('hat', 2)]);
  document = editCart(document, { type: 'setQuantity', variantId: 'shirt-m', quantity: 1 }, 'a');
  document = editCart(document, { type: 'remove', variantId: 'hat' }, 'b');
  document = reconcileCart(document, [line('shirt-m', 4), line('hat', 2), line('bag')]);
  assert.equal(quantity(document), 1);
  assert.equal(quantity(document, 'hat'), 0);
  assert.equal(quantity(document, 'bag'), 1);
  assert.equal(document.edits.hat.quantity, 0);
});

test('different-item remote changes merge automatically while the same-item change becomes a conflict', () => {
  let document = editCart(
    account([line('shirt-m', 3)]),
    { type: 'setQuantity', variantId: 'shirt-m', quantity: 2 },
    'a',
  );
  document = reconcileCart(document, [line('shirt-m', 4), line('hat', 2)]);
  assert.equal(quantity(document), 2);
  assert.equal(quantity(document, 'hat'), 2);
  assert.deepEqual(document.edits['shirt-m'].conflict, { remoteQuantity: 4 });
  const local = resolveCartConflict(document, 'shirt-m', 'local', 'choice');
  assert.equal(local.edits['shirt-m'].baseQuantity, 4);
  assert.equal(local.edits['shirt-m'].conflict, undefined);
  assert.equal(quantity(reconcileCart(local, [line('shirt-m', 4)])), 2);
  assert.deepEqual(reconcileCart(local, [line('shirt-m', 5)]).edits['shirt-m'].conflict, {
    remoteQuantity: 5,
  });
  const remote = resolveCartConflict(document, 'shirt-m', 'remote', 'choice');
  assert.equal(quantity(remote), 4);
  assert.equal(remote.edits['shirt-m'], undefined);
});

test('a successful write acknowledges its sent version and preserves an edit made while it was in flight', () => {
  let document = editCart(account([line()]), { type: 'add', line: line() }, 'first');
  document = sending(document);
  const flight = document.flights['shirt-m'];
  document = editCart(document, { type: 'add', line: line() }, 'newer');
  document = settleCartWrite(document, flight, [line('shirt-m', 2)]);
  assert.equal(quantity(document), 3);
  assert.equal(document.edits['shirt-m'].id, 'newer');
  assert.equal(document.edits['shirt-m'].baseQuantity, 2);
  assert.deepEqual(document.flights, {});
});

test('an in-flight addition followed by removal survives acknowledgement as a pending removal', () => {
  let document = editCart(account(), { type: 'add', line: line() }, 'add');
  document = sending(document, 'add');
  const flight = document.flights['shirt-m'];
  document = editCart(document, { type: 'remove', variantId: 'shirt-m' }, 'remove');
  document = settleCartWrite(document, flight, [line()]);
  assert.equal(quantity(document), 0);
  assert.equal(document.edits['shirt-m'].quantity, 0);
  assert.equal(document.edits['shirt-m'].baseQuantity, 1);
});

test('a stale response from a replaced flight cannot alter the current document', () => {
  const document = sending(editCart(account([line()]), { type: 'add', line: line() }, 'current'));
  assert.equal(
    settleCartWrite(document, { ...document.flights['shirt-m'], editId: 'old' }, []),
    document,
  );
});

test('an uncertain additive write remains recorded and requires reconciliation rather than blind replay', () => {
  let document = sending(
    editCart(account(), { type: 'add', line: line('shirt-m', 2) }, 'a'),
    'add',
  );
  document.flights['shirt-m'] = { ...document.flights['shirt-m'], phase: 'uncertain' };
  document = reconcileCart(document, [line('shirt-m', 2)]);
  assert.equal(document.flights['shirt-m'].phase, 'uncertain');
  assert.equal(document.edits['shirt-m'].id, 'a');
  assert.deepEqual(document.edits['shirt-m'].conflict, { remoteQuantity: 2 });
});

test('a mismatched write readback is visible as a conflict instead of losing the local quantity', () => {
  let document = sending(editCart(account([line()]), { type: 'add', line: line() }, 'a'));
  document = settleCartWrite(document, document.flights['shirt-m'], [line('shirt-m', 4)]);
  assert.equal(quantity(document), 2);
  assert.equal(document.flights['shirt-m'].phase, 'uncertain');
  assert.deepEqual(document.edits['shirt-m'].conflict, { remoteQuantity: 4 });
});

test('guest import is recorded once and the same saved contribution cannot inflate a later refresh', () => {
  const guest = editCart(
    createCartDocument('guest', 'guest-one'),
    { type: 'add', line: line('shirt-m', 2) },
    'guest-edit',
  );
  let document = mergeGuestCart(account([line('shirt-m', 3)]), guest, () => 'merge');
  assert.equal(quantity(document), 5);
  document = mergeGuestCart(document, guest, () => 'duplicate');
  assert.equal(quantity(document), 5);
  assert.deepEqual(document.importedGuestIds, ['guest-one']);
  assert.equal(quantity(reconcileCart(document, [line('shirt-m', 3)])), 5);
  assert.throws(() =>
    mergeGuestCart(createCartDocument('guest', 'guest-two'), guest, () => 'invalid'),
  );
});

test('an empty guest cart does not consume the import identity before later guest additions', () => {
  const document = account([line('shirt-m', 3)]);
  let guest = createCartDocument('guest', 'empty-guest');
  assert.equal(
    mergeGuestCart(document, guest, () => 'empty'),
    document,
  );
  guest = editCart(guest, { type: 'add', line: line('shirt-m', 2) }, 'guest-add');
  assert.equal(quantity(mergeGuestCart(document, guest, () => 'merge')), 5);
});

test('clear records only known lines, preserving a different item added remotely afterwards', () => {
  let document = editCart(account([line(), line('hat')]), { type: 'clear' }, 'clear');
  document = reconcileCart(document, [line(), line('hat'), line('bag')]);
  assert.deepEqual(
    projectCart(document).map((item) => item.variantId),
    ['bag'],
  );
  assert.equal(document.edits['shirt-m'].quantity, 0);
  assert.equal(document.edits.hat.quantity, 0);
});

test('purchase consumption removes the purchased quantity once and retains later additions and other lines', () => {
  let document = editCart(
    createCartDocument('guest', 'guest'),
    { type: 'add', line: line('shirt-m', 2) },
    'initial',
  );
  const purchased = [{ variantId: 'shirt-m', quantity: 2, lineage: document.lineage['shirt-m'] }];
  document = editCart(document, { type: 'add', line: line('shirt-m', 3) }, 'later-add');
  document = editCart(document, { type: 'add', line: line('hat', 4) }, 'hat');
  document = consumeCartPurchase(document, 'order-one', purchased, () => 'consume');
  assert.equal(quantity(document), 3);
  assert.equal(quantity(document, 'hat'), 4);
  assert.equal(
    consumeCartPurchase(document, 'order-one', purchased, () => 'duplicate'),
    document,
  );
});

test('purchase cleanup cannot remove a new incarnation of a removed and re-added item', () => {
  let document = editCart(
    createCartDocument('guest', 'guest'),
    { type: 'add', line: line('shirt-m', 2) },
    'initial',
  );
  const purchased = [{ variantId: 'shirt-m', quantity: 2, lineage: document.lineage['shirt-m'] }];
  document = editCart(document, { type: 'remove', variantId: 'shirt-m' }, 'remove');
  document = editCart(document, { type: 'add', line: line() }, 'replacement');
  document = consumeCartPurchase(document, 'order-one', purchased, () => 'consume');
  assert.equal(quantity(document), 1);
  assert.equal(document.lineage['shirt-m'], 'replacement');
});

test('persisted account documents are scoped, validated, and retain only matching checkout snapshots', () => {
  const document = editCart(account([line()]), { type: 'add', line: line('hat', 2) }, 'hat');
  const stored = {
    ...document,
    edits: { ...document.edits, bad: { quantity: 'two' } },
    lineage: undefined,
    checkoutSnapshots: {
      valid: {
        owner: document.owner,
        cartId: document.cartId,
        lines: [{ variantId: 'shirt-m', quantity: 1 }],
      },
      other: {
        owner: 'user:bob',
        cartId: document.cartId,
        lines: [{ variantId: 'shirt-m', quantity: 1 }],
      },
    },
  };
  assert.equal(normalizeCartDocument(stored, 'user:bob'), null);
  const recovered = normalizeCartDocument(stored, 'user:alice');
  assert.ok(recovered);
  assert.equal(quantity(recovered, 'hat'), 2);
  assert.equal(recovered.edits.bad, undefined);
  assert.deepEqual(Object.keys(recovered.checkoutSnapshots), ['valid']);
  assert.ok(recovered.lineage['shirt-m']);
});

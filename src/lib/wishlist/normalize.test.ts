import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeWishlistProductIds,
  parseWishlistMutationBody,
  WishlistPayloadError,
} from './normalize';

test('validates explicit ID and product arrays while preserving order and removing duplicates', () => {
  assert.deepEqual(
    normalizeWishlistProductIds({
      success: true,
      data: ['a', { external_product_id: 'b', id: 'django-uuid' }, 'a', { _id: 'c' }],
    }),
    ['a', 'b', 'c'],
  );
});

test('validates Wishlist product_ids arrays and keyed membership/product maps', () => {
  assert.deepEqual(
    normalizeWishlistProductIds({ success: true, data: { product_ids: ['a', 'b'] } }),
    ['a', 'b'],
  );
  assert.deepEqual(
    normalizeWishlistProductIds({
      success: true,
      data: { product_ids: { a: true, b: { external_product_id: 'b' } } },
    }),
    ['a', 'b'],
  );
  assert.deepEqual(normalizeWishlistProductIds({ success: true, data: { product_ids: {} } }), []);
  assert.deepEqual(normalizeWishlistProductIds({ success: true, data: [] }), []);
});

test('does not decode undocumented data:string or mistake malformed data for an empty list', () => {
  for (const data of [
    '[]',
    '{"product_ids":[]}',
    null,
    {},
    { product_ids: '[]' },
    [{ id: 'django-uuid' }],
  ]) {
    assert.throws(() => normalizeWishlistProductIds({ success: true, data }), WishlistPayloadError);
  }
  assert.throws(
    () => normalizeWishlistProductIds({ success: false, data: [] }),
    WishlistPayloadError,
  );
});

test('rejects IDs unsafe for product paths and mismatched product maps', () => {
  for (const id of ['', '../admin', 'a/b', ' a', 'https://example.com', 'x'.repeat(201)]) {
    assert.throws(
      () => normalizeWishlistProductIds({ success: true, data: [id] }),
      WishlistPayloadError,
    );
  }
  assert.throws(
    () =>
      normalizeWishlistProductIds({
        success: true,
        data: { product_ids: { a: { external_product_id: 'b' } } },
      }),
    WishlistPayloadError,
  );
  assert.throws(
    () => normalizeWishlistProductIds({ success: true, data: { product_ids: { a: false } } }),
    WishlistPayloadError,
  );
});

test('validates bounded mutation requests and restricts operations to add/remove', () => {
  assert.deepEqual(parseWishlistMutationBody({ action: 'remove', product_ids: ['a', 'a'] }), {
    action: 'remove',
    product_ids: ['a'],
  });
  for (const body of [
    { action: 'clear', product_ids: ['a'] },
    { action: 'add', product_ids: [] },
    { action: 'add', product_ids: ['../a'] },
    { action: 'add', product_ids: Array(101).fill('a') },
  ]) {
    assert.throws(() => parseWishlistMutationBody(body), WishlistPayloadError);
  }
});

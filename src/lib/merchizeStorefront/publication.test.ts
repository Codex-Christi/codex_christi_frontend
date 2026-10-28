import assert from 'node:assert/strict';
import test from 'node:test';
import { getStorefrontPublication } from './publication';
import { isMerchizeStorefrontProductAvailable } from '@/lib/paypal/orderSnapshot/merchizeAvailability';

const published = {
  is_active: true,
  is_private: false,
  is_deleted: false,
  is_taken_down: false,
  approval_status: 'approved',
};

test('display publication requires actual negative evidence, not missing legacy fields', () => {
  for (const product of [
    null,
    undefined,
    [],
    {},
    { title: 'Legacy product' },
    { is_active: 'false' },
  ]) {
    assert.equal(getStorefrontPublication(product), 'unknown');
  }
  assert.equal(isMerchizeStorefrontProductAvailable({}), false);
  assert.equal(getStorefrontPublication(published), 'published');
  for (const change of [
    { is_active: false },
    { is_private: true },
    { is_deleted: true },
    { is_taken_down: true },
    { approval_status: ' PENDING ' },
    { status: 'draft' },
    { _storefront_not_found: true },
  ]) {
    assert.equal(getStorefrontPublication({ ...published, ...change }), 'unpublished');
  }
  assert.equal(getStorefrontPublication({ ...published, status: ' Active ' }), 'published');
});

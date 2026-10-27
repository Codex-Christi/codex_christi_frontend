import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canUseSavedListing,
  InvalidStorefrontListingPayloadError,
  parseStorefrontCategoryMetadata,
  parseStorefrontCollections,
  parseStorefrontListing,
} from './listingPayload';
import { MerchizeProviderError } from './providerErrors';

test('category payloads require meaningful identities but permit an intentional empty collection', () => {
  assert.deepEqual(parseStorefrontCollections({ success: true, data: { collections: [] } }), []);
  for (const value of [
    null,
    {},
    { data: { collections: [{}] } },
    { success: false, data: { collections: [] } },
  ]) {
    assert.throws(() => parseStorefrontCollections(value), InvalidStorefrontListingPayloadError);
  }
  assert.throws(
    () => parseStorefrontCategoryMetadata({ data: {} }),
    InvalidStorefrontListingPayloadError,
  );
  assert.throws(
    () => parseStorefrontCategoryMetadata({ data: { name: ' ' } }),
    InvalidStorefrontListingPayloadError,
  );
  assert.equal(
    parseStorefrontCategoryMetadata({ data: { name: 'Hoodies', cover: null } }).name,
    'Hoodies',
  );
});

test('listings reject bad rows, duplicate identities, wrong pages, and oversized responses', () => {
  const product = { _id: 'p1', title: 'Hoodie', retail_price: '30' };
  const data = { total: 1, pages: 1, page: 1, products: [product] };
  assert.equal(
    parseStorefrontListing({ success: true, data }, 1, 15).products[0].retail_price,
    '30',
  );
  for (const override of [
    { products: null },
    { products: [{}] },
    { page: 2 },
    { pages: -1 },
    { total: 0 },
    { products: [product, product], total: 2 },
    { products: [{ ...product, retail_price: 'NaN' }] },
  ])
    assert.throws(
      () => parseStorefrontListing({ data: { ...data, ...override } }, 1, 15),
      InvalidStorefrontListingPayloadError,
    );
  assert.throws(() => parseStorefrontListing({ data }, 1, 0), InvalidStorefrontListingPayloadError);
  assert.deepEqual(
    parseStorefrontListing({ data: { page: 1, pages: 0, total: 0, products: [] } }, 1, 15).products,
    [],
  );
});

test('saved listings never override confirmed missing or invalid-request responses', () => {
  for (const status of [404, 410, 400, 422])
    assert.equal(canUseSavedListing(new MerchizeProviderError({ url: '', status })), false);
  for (const status of [null, 403, 408, 429, 503])
    assert.equal(canUseSavedListing(new MerchizeProviderError({ url: '', status })), true);
  assert.equal(canUseSavedListing(new InvalidStorefrontListingPayloadError()), true);
  assert.equal(canUseSavedListing(new SyntaxError('Invalid JSON')), true);
  assert.equal(canUseSavedListing(new Error('Programming error')), false);
});

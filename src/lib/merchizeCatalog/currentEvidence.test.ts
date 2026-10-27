import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSupplierEvidenceResolver,
  type SupplierEvidenceDependencies,
  type SupplierProductEvidence,
} from './currentEvidence';

const product: SupplierProductEvidence = {
  _id: 'supplier-product',
  sku: '6014US',
  variants: [
    {
      _id: 'supplier-variant',
      sku: '6014US000BERAA01',
      shipping_prices: [{ to_zone: 'US', to_country: 'all', first_item: 7, additional_item: 2 }],
    },
  ],
};
const sku = product.variants[0].sku;
const now = new Date('2026-10-26T12:00:00Z');
function setup(overrides: Partial<SupplierEvidenceDependencies> = {}) {
  let calls = 0;
  let writes = 0;
  const resolver = createSupplierEvidenceResolver({
    read: async () => null,
    write: async () => {
      writes += 1;
    },
    locate: async () => new Map([[sku, { productSku: product.sku }]]),
    fetchPage: async () => {
      calls += 1;
      return { success: true, data: { page: 1, limit: 50, total: 1, products: [product] } };
    },
    now: () => now,
    ttlMs: 1000,
    ...overrides,
  });
  return { resolver, counts: () => ({ calls, writes }) };
}
test('fresh product evidence avoids provider requests independently of full-catalog generation', async () => {
  const { resolver, counts } = setup({ read: async () => ({ product, verifiedAt: now }) });
  assert.equal((await resolver.resolve([sku])).variants.length, 1);
  assert.equal(counts().calls, 0);
});
test('expired evidence is renewed once and shared by pricing/shipping lookups', async () => {
  const { resolver, counts } = setup({
    read: async () => ({ product, verifiedAt: new Date(now.getTime() - 2000) }),
  });
  const [a, b] = await Promise.all([resolver.resolve([sku]), resolver.resolve([sku])]);
  assert.equal(a.variants[0].supplierVariantId, 'supplier-variant');
  assert.equal(b.variants[0].catalogRow.shippingBands?.length, 1);
  assert.deepEqual(counts(), { calls: 1, writes: 1 });
});
test('valid live proof survives an unavailable supplier cache', async () => {
  const { resolver } = setup({
    read: async () => {
      throw Error('offline');
    },
    write: async () => {
      throw Error('offline');
    },
  });
  assert.equal((await resolver.resolve([sku])).generationAvailable, true);
});
test('a confirmed removed SKU is unavailable, never served from old evidence', async () => {
  const { resolver } = setup({
    fetchPage: async () => ({
      success: true,
      data: { page: 1, limit: 50, total: 1, products: [{ ...product, variants: [] }] },
    }),
  });
  const result = await resolver.resolve([sku]);
  assert.equal(result.generationAvailable, true);
  assert.deepEqual(result.variants, []);
});
test('unresolved discovery is unverified, not a fabricated missing-SKU verdict', async () => {
  const { resolver } = setup({
    locate: async () => new Map(),
    fetchPage: async () => ({
      success: true,
      data: { page: 1, limit: 50, total: 0, products: [] },
    }),
  });
  assert.deepEqual((await resolver.resolve([sku])).unverifiedSkus, [sku]);
});
test('discovery only approves an exact full SKU in a validated current product', async () => {
  const { resolver } = setup({ locate: async () => new Map() });
  assert.equal((await resolver.resolve([sku])).variants[0].sku, sku);
});
for (const [name, response] of [
  [
    'malformed variants',
    {
      success: true,
      data: { page: 1, limit: 50, total: 1, products: [{ ...product, variants: null }] },
    },
  ],
  [
    'duplicate variant identities',
    {
      success: true,
      data: {
        page: 1,
        limit: 50,
        total: 1,
        products: [{ ...product, variants: [...product.variants, ...product.variants] }],
      },
    },
  ],
  ['truncated pagination', { success: true, data: { page: 1, limit: 50, total: 2, products: [] } }],
] as const)
  test(`${name} cannot become availability evidence`, async () => {
    const { resolver, counts } = setup({ fetchPage: async () => response });
    const result = await resolver.resolve([sku]);
    assert.deepEqual(result.unverifiedSkus, [sku]);
    assert.equal(counts().writes, 0);
  });
test('provider failures remain unverified without promoting stale data', async () => {
  const { resolver } = setup({
    fetchPage: async () => {
      throw Error('timeout');
    },
  });
  assert.deepEqual((await resolver.resolve([sku])).unverifiedSkus, [sku]);
});
test('manual product rechecks bypass even fresh positive or negative evidence', async () => {
  for (const saved of [product, null]) {
    const { resolver, counts } = setup({
      forceRefresh: true,
      read: async () => ({ product: saved, verifiedAt: now }),
    });
    assert.equal((await resolver.resolve([sku])).variants.length, 1);
    assert.equal(counts().calls, 1);
  }
});
test('one product failure does not disable another product with current evidence', async () => {
  const otherSku = 'OTHER-1';
  const { resolver } = setup({
    locate: async () =>
      new Map([
        [sku, { productSku: product.sku }],
        [otherSku, { productSku: 'OTHER' }],
      ]),
    fetchPage: async ([query]) => {
      if (query === 'OTHER') throw Error('supplier failure');
      return { success: true, data: { page: 1, limit: 50, total: 1, products: [product] } };
    },
  });
  const result = await resolver.resolve([sku, otherSku]);
  assert.deepEqual(
    result.variants.map((v) => v.sku),
    [sku],
  );
  assert.deepEqual(result.unverifiedSkus, [otherSku]);
});
test('current preset hints avoid historical variant lookups', async () => {
  const { resolver } = setup({
    locate: async () => {
      throw Error('should not be called');
    },
  });
  resolver.remember(product);
  assert.equal((await resolver.resolve([sku])).variants.length, 1);
});

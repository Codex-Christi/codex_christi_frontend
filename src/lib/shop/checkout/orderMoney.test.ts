import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateOrderPreviewTotals,
  formatOrderMoney,
  resolveOrderCurrency,
  shippingUsdCentsToMinor,
  unitUsdToMinor,
  type OrderCurrencyResolution,
} from './orderMoney';
import {
  resolveCanonicalOrderSnapshot,
  type CanonicalOrderResolverDependencies,
} from '@/lib/paypal/orderSnapshot/resolver';
import type { CatalogItem } from '@/lib/datasetSearchers/merchize/catalog';

/** All product, FX, and shipping evidence is local; no orders or database rows are created. */
async function previewAndSnapshot(
  lines: Array<{ variantId: string; unitPriceUsd: number; quantity: number }>,
  shippingUsdCents: number,
  resolution: OrderCurrencyResolution,
) {
  const dependencies: CanonicalOrderResolverDependencies = {
    resolveProduct: async () => ({
      productId: 'fixture-product',
      title: 'Fixture product',
      isAvailable: true,
      variants: lines.map((line) => ({
        ...line,
        productId: 'fixture-product',
        supplierProductId: 'fixture-supplier',
        supplierVariantId: line.variantId,
        sku: `SKU-${line.variantId}`,
        sellerSku: null,
        title: 'Fixture option',
        selectedOptions: [],
        imageUrl: 'https://example.invalid/fixture.jpg',
        priceSource: 'live' as const,
        isAvailable: true,
      })),
    }),
    resolveCatalogVariants: async (skus) =>
      lines
        .filter((line) => skus.includes(`SKU-${line.variantId}`))
        .map((line) => ({
          sku: `SKU-${line.variantId}`,
          supplierProductId: 'fixture-supplier',
          supplierVariantId: line.variantId,
          catalogRow: {
            SKU_product: 'fixture-supplier',
            SKU_variant: `SKU-${line.variantId}`,
          } as CatalogItem,
        })),
    resolveCurrency: async () => resolution,
    resolveShipping: async ({ lines: shippingLines }) => ({
      source: 'MERCHIZE_CATALOG',
      totalUsdCents: shippingUsdCents,
      allocationsUsdCents: Object.fromEntries(
        shippingLines.map((line, index) => [line.lineId, index === 0 ? shippingUsdCents : 0]),
      ),
      rowFallbackSkus: [],
    }),
    now: () => new Date('2026-10-27T12:00:00Z'),
  };
  const snapshot = await resolveCanonicalOrderSnapshot(
    {
      selections: lines.map((line) => ({
        productId: 'fixture-product',
        variantId: line.variantId,
        quantity: line.quantity,
      })),
      destination: { countryIso3: 'DEU' },
    },
    dependencies,
  );
  const preview = calculateOrderPreviewTotals(lines, shippingUsdCents, resolution);
  assert.equal(preview.currency, snapshot.currency);
  assert.equal(preview.retailPriceTotalNum, Number(snapshot.subtotal.value));
  assert.equal(preview.shippingPriceNum, Number(snapshot.shipping.value));
  assert.equal(preview.totalPriceNum, Number(snapshot.total.value));
  for (const line of snapshot.lines) {
    assert.deepEqual(preview.linePricesByVariantId[line.variantId], {
      unitPriceNum: Number(line.unitAmount.value),
      lineTotalNum: Number(line.lineAmount.value),
    });
  }
  return preview;
}

test('EUR preview and canonical totals round the unit before multiplying quantity', async () => {
  const preview = await previewAndSnapshot(
    [{ variantId: 'a', unitPriceUsd: 15.25, quantity: 3 }],
    1500,
    { currency: 'EUR', multiplier: 0.92345 },
  );
  assert.deepEqual(preview.linePricesByVariantId.a, { unitPriceNum: 14.08, lineTotalNum: 42.24 });
  assert.equal(preview.retailPriceTotalNum, 42.24);
  assert.equal(preview.shippingPriceNum, 13.86);
  assert.equal(preview.totalPriceNum, 56.1);
});

test('multi-line preview totals and line displays match the canonical snapshot', async () => {
  const preview = await previewAndSnapshot(
    [
      { variantId: 'a', unitPriceUsd: 15.25, quantity: 3 },
      { variantId: 'b', unitPriceUsd: 9.99, quantity: 2 },
    ],
    1500,
    { currency: 'EUR', multiplier: 0.92345 },
  );
  assert.equal(preview.retailPriceTotalNum, 60.7);
  assert.equal(preview.totalPriceNum, 74.56);
});

test('HUF, JPY, and TWD use canonical zero-digit unit and shipping rounding', async () => {
  for (const currency of ['HUF', 'JPY', 'TWD']) {
    const preview = await previewAndSnapshot(
      [{ variantId: 'a', unitPriceUsd: 15.25, quantity: 3 }],
      225,
      { currency, multiplier: 1.11 },
    );
    assert.equal(preview.retailPriceTotalNum, 51);
    // Rounding cents upward first would incorrectly turn 2.4975 into 3.
    assert.equal(preview.shippingPriceNum, 2);
    assert.equal(preview.totalPriceNum, 53);
    assert.equal(formatOrderMoney(53, currency).includes('.00'), false);
  }
});

test('USD previews retain exact multi-line totals without floating-point addition drift', async () => {
  const lines = [
    { variantId: 'a', unitPriceUsd: 0.1, quantity: 3 },
    { variantId: 'b', unitPriceUsd: 0.2, quantity: 1 },
  ];
  const usd = { currency: 'USD', multiplier: 1 };
  const preview = await previewAndSnapshot(lines, 500, usd);
  assert.equal(preview.retailPriceTotalNum, 0.5);
  assert.equal(preview.totalPriceNum, 5.5);
  assert.equal(calculateOrderPreviewTotals(lines, 0, usd).totalPriceNum, 0.5);
});

test('preview and canonical adapters share the supported-currency fallback', async () => {
  for (const conversion of [
    { currency: 'NGN', multiplier: 1400 },
    { currency: undefined, multiplier: 1 },
  ]) {
    const resolution = resolveOrderCurrency(conversion);
    assert.deepEqual(resolution, { currency: 'USD', multiplier: 1 });
    const preview = await previewAndSnapshot(
      [{ variantId: 'a', unitPriceUsd: 15.25, quantity: 3 }],
      500,
      resolution,
    );
    assert.equal(preview.totalPriceNum, 50.75);
  }
  assert.deepEqual(resolveOrderCurrency({ currency: 'eur', multiplier: 0.92345 }), {
    currency: 'EUR',
    multiplier: 0.92345,
  });
});

test('invalid conversion, quantities, and overflowing money cannot become preview totals', () => {
  const usd = { currency: 'USD', multiplier: 1 };
  for (const multiplier of [NaN, Infinity, 0, -1]) {
    assert.throws(() => unitUsdToMinor(10, { ...usd, multiplier }), RangeError);
    assert.throws(() => shippingUsdCentsToMinor(500, { ...usd, multiplier }), RangeError);
  }
  for (const quantity of [0, -1, 0.5, Number.MAX_SAFE_INTEGER])
    assert.throws(
      () => calculateOrderPreviewTotals([{ variantId: 'a', unitPriceUsd: 10, quantity }], 0, usd),
      RangeError,
    );
  assert.throws(() => unitUsdToMinor(Infinity, usd), RangeError);
  assert.throws(() => unitUsdToMinor(-1, usd), RangeError);
  assert.throws(() => shippingUsdCentsToMinor(1.5, usd), RangeError);
});

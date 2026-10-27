import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateDestinationOptions } from './destinationAvailability';
import {
  supplierVariantRecord,
  type SupplierShippingBand,
} from '@/lib/merchizeCatalog/currentEvidence';

function evaluate(bands: SupplierShippingBand[] | undefined, countryIso3 = 'USA') {
  const row = supplierVariantRecord(
    { _id: 'p', sku: 'P', variants: [] },
    { _id: 'v', sku: 'SKU', shipping_prices: bands },
  ).catalogRow;
  return evaluateDestinationOptions({
    options: [{ variantId: 'variant', sku: 'SKU' }],
    catalogRows: [row],
    countryIso3,
  });
}
test('destination availability uses the same trusted shipping rules as checkout', () => {
  assert.deepEqual(
    evaluate([{ to_zone: 'US', to_country: 'all', first_item: 7, additional_item: 2 }])
      .availableVariantIds,
    ['variant'],
  );
});
test('country checks preserve checkout regional-to-ROW fallback', () => {
  assert.deepEqual(
    evaluate([{ to_zone: 'ROW', to_country: 'all', first_item: 10, additional_item: 4 }], 'NGA')
      .availableVariantIds,
    ['variant'],
  );
});
test('complete evidence without a destination band is unsupported', () => {
  assert.deepEqual(
    evaluate([{ to_zone: 'US', to_country: 'all', first_item: 7, additional_item: 2 }], 'NGA')
      .unsupportedVariantIds,
    ['variant'],
  );
  assert.deepEqual(evaluate([]).unsupportedVariantIds, ['variant']);
});
test('missing shipping evidence is unverified, not a confirmed country restriction', () => {
  assert.deepEqual(evaluate(undefined).unverifiedVariantIds, ['variant']);
});
test('conflicting destination fees are unverified, never silently chosen', () => {
  assert.deepEqual(
    evaluate([
      { to_zone: 'US', to_country: 'US', first_item: 7, additional_item: 2 },
      { to_zone: 'US', to_country: 'US', first_item: 9, additional_item: 2 },
    ]).unverifiedVariantIds,
    ['variant'],
  );
});

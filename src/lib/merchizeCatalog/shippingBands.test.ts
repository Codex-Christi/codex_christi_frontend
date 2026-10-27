import assert from 'node:assert/strict';
import test from 'node:test';
import { selectSupplierShippingBand } from './shippingBands';
const band = (to_country: string, first_item: number) => ({
  to_zone: 'EU',
  to_country,
  first_item,
  additional_item: 2,
});
test('country and country-group bands take precedence over generic zones', () => {
  const bands = [band('all', 10), band('DE', 7), band('NL, AT, BE', 8), band('Rest of EU', 9)];
  assert.equal(selectSupplierShippingBand(bands, 'EU', 'DEU')?.first_item, 7);
  assert.equal(selectSupplierShippingBand(bands, 'EU', 'NLD')?.first_item, 8);
  assert.equal(selectSupplierShippingBand(bands, 'EU', 'FRA')?.first_item, 9);
});
test('conflicting rates fail closed; identical duplicate bands are harmless', () => {
  assert.throws(
    () => selectSupplierShippingBand([band('DE', 7), band('DE', 8)], 'EU', 'DEU'),
    /conflicting/,
  );
  assert.equal(
    selectSupplierShippingBand([band('DE', 7), band('DE', 7)], 'EU', 'DEU')?.first_item,
    7,
  );
});

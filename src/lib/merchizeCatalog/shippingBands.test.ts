import assert from 'node:assert/strict';
import test from 'node:test';
import { countries } from 'country-data-list';
import {
  normalizeCountryToIso2,
  normalizeCountryToIso3,
} from '@/lib/utils/shop/checkout/normalizeCountryToIso3';
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

test('country codes and names retain the first source match, including historical aliases', () => {
  for (const country of countries.all) {
    for (const alias of [country.alpha2, country.alpha3, country.name]) {
      if (!alias) continue;
      const normalized = alias.toUpperCase();
      const first = countries.all.find((candidate) =>
        [candidate.alpha2, candidate.alpha3, candidate.name].some(
          (value) => value?.toUpperCase() === normalized,
        ),
      )!;
      const input = ` ${alias.toLowerCase()} `;
      assert.equal(normalizeCountryToIso2(input), first.alpha2?.toUpperCase() ?? null, alias);
      assert.equal(normalizeCountryToIso3(input), first.alpha3?.toUpperCase() ?? null, alias);
    }
  }
});

test('unknown or empty countries cannot resolve to a shipping destination', () => {
  for (const input of [undefined, null, '', '   ', 'ZZZ', 'not a country']) {
    assert.equal(normalizeCountryToIso2(input), null);
    assert.equal(normalizeCountryToIso3(input), null);
  }
});

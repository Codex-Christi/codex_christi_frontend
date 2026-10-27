import assert from 'node:assert/strict';
import test from 'node:test';
import { countries } from 'country-data-list';
import generated from '@/datasets/storefront-country-index.json';
import { getDefaultISO3 } from '@/lib/utils/shop/geo/getDefaultISO3.client';
import {
  getCountryISO3FromISO2,
  getStorefrontCountryIdentity,
} from '@/lib/utils/shop/geo/storefrontCountryIndex';

const selectable = countries.all.filter(
  (country) => country.emoji && country.status !== 'deleted' && country.ioc !== 'PRK',
);

test('generated identities match the installed dataset and existing chooser filters', () => {
  assert.deepEqual(
    generated,
    countries.all.map(({ alpha2, alpha3, name, emoji, status, ioc }) => ({
      alpha2,
      alpha3,
      name,
      selectable: Boolean(emoji && status !== 'deleted' && ioc !== 'PRK'),
    })),
    'Regenerate with yarn node scripts/generate-storefront-country-index.mjs',
  );
});

test('ISO2 lookups retain the original first match, including historical aliases', () => {
  for (const { alpha2 } of countries.all) {
    const expected = countries.all
      .find((country) => country.alpha2 === alpha2)
      ?.alpha3.toUpperCase();
    assert.equal(getCountryISO3FromISO2(alpha2), expected, alpha2);
    assert.equal(getCountryISO3FromISO2(alpha2.toLowerCase()), expected, alpha2);
  }
  assert.equal(getCountryISO3FromISO2('AI'), 'AIA');
  assert.equal(getCountryISO3FromISO2('XX'), null);
  assert.equal(getCountryISO3FromISO2(''), null);
});

test('display identities retain the chooser order, names, flags and exclusions', () => {
  const expected = new Map(selectable.map((country) => [country.alpha3.toUpperCase(), country]));
  for (const [iso3, country] of expected) {
    const actual = getStorefrontCountryIdentity(iso3.toLowerCase());
    assert.ok(actual, iso3);
    assert.equal(actual.name, country.name, iso3);
    assert.equal(actual.alpha2, country.alpha2, iso3);
    assert.equal(actual.alpha3, country.alpha3, iso3);
  }
  for (const { alpha3 } of countries.all) {
    assert.equal(
      Boolean(getStorefrontCountryIdentity(alpha3)),
      expected.has(alpha3.toUpperCase()),
      alpha3,
    );
  }
  assert.equal(getStorefrontCountryIdentity('PRK'), undefined);
  assert.equal(getStorefrontCountryIdentity('ZZZ'), undefined);
});

function resolveClientCountry(cookie: string, language: string, languages = [language]) {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie } });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { language, languages },
    });
    return getDefaultISO3();
  } finally {
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor);
    else Reflect.deleteProperty(globalThis, 'document');
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
}

test('saved country wins over browser locale without changing the cookie', () => {
  const cookie = `cc_currency_v1=${encodeURIComponent(JSON.stringify({ v: 1, iso3: ' gbr ', updatedAt: 1 }))}`;
  assert.equal(resolveClientCountry(cookie, 'fr-CA'), 'GBR');
  assert.equal(
    resolveClientCountry(
      `cc_currency_v1=${encodeURIComponent(JSON.stringify({ v: 1, iso3: 'USA', updatedAt: 1 }))}`,
      'de-DE',
    ),
    'USA',
  );
});

test('locale, navigator fallback and unknown-country behavior remain unchanged', () => {
  assert.equal(resolveClientCountry('', 'en-GB'), 'GBR');
  assert.equal(resolveClientCountry('cc_currency_v1=invalid', 'fr-CA'), 'CAN');
  assert.equal(resolveClientCountry('', 'fr-FR', []), 'FRA');
  assert.equal(resolveClientCountry('', 'en-AI'), 'AIA');
  assert.equal(resolveClientCountry('', 'en-XX'), 'USA');
  assert.equal(resolveClientCountry('', 'en'), 'USA');
});

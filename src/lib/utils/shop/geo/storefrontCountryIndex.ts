import countries from '@/datasets/storefront-country-index.json';

export type StorefrontCountryIdentity = {
  alpha2: string;
  alpha3: string;
  name: string;
};

const iso3ByISO2 = new Map<string, string>();
const displayByISO3 = new Map<string, StorefrontCountryIdentity>();

// Preserve the detector's first match and the chooser's last selectable match.
for (const country of countries) {
  const iso2 = country.alpha2.toUpperCase();
  const iso3 = country.alpha3.toUpperCase();
  if (!iso3ByISO2.has(iso2)) iso3ByISO2.set(iso2, iso3);
  if (country.selectable) displayByISO3.set(iso3, country);
}

export function getCountryISO3FromISO2(iso2: string): string | null {
  return iso3ByISO2.get(iso2.toUpperCase()) ?? null;
}

export function getStorefrontCountryIdentity(iso3: string): StorefrontCountryIdentity | undefined {
  return displayByISO3.get(iso3.toUpperCase());
}

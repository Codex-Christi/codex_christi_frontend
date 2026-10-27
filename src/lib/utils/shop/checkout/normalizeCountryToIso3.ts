import countries from '@/datasets/storefront-country-index.json';

const countryByAlias = new Map<string, (typeof countries)[number]>();
for (const country of countries) {
  for (const alias of [country.alpha2, country.alpha3, country.name]) {
    const key = alias?.toUpperCase();
    // Historical entries share codes; preserve the original first-match precedence.
    if (key && !countryByAlias.has(key)) countryByAlias.set(key, country);
  }
}

function findCountryMatch(value?: string | null) {
  const normalized = value?.trim().toUpperCase();
  return normalized ? (countryByAlias.get(normalized) ?? null) : null;
}

export function normalizeCountryToIso3(value?: string | null): string | null {
  const match = findCountryMatch(value);

  return match?.alpha3?.toUpperCase() ?? null;
}

export function normalizeCountryToIso2(value?: string | null): string | null {
  const match = findCountryMatch(value);

  return match?.alpha2?.toUpperCase() ?? null;
}

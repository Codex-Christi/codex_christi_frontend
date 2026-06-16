import { countries } from 'country-data-list';

function findCountryMatch(value?: string | null) {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) return null;

  return countries.all.find((country) => {
    const alpha2 = country.alpha2?.toUpperCase();
    const alpha3 = country.alpha3?.toUpperCase();
    const name = country.name?.toUpperCase();

    return alpha2 === normalized || alpha3 === normalized || name === normalized;
  });
}

export function normalizeCountryToIso3(value?: string | null): string | null {
  const match = findCountryMatch(value);

  return match?.alpha3?.toUpperCase() ?? null;
}

export function normalizeCountryToIso2(value?: string | null): string | null {
  const match = findCountryMatch(value);

  return match?.alpha2?.toUpperCase() ?? null;
}

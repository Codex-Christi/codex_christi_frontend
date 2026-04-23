import { countries } from 'country-data-list';

export function normalizeCountryToIso3(value?: string | null): string | null {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) return null;

  const match = countries.all.find((country) => {
    const alpha2 = country.alpha2?.toUpperCase();
    const alpha3 = country.alpha3?.toUpperCase();
    const name = country.name?.toUpperCase();

    return alpha2 === normalized || alpha3 === normalized || name === normalized;
  });

  return match?.alpha3?.toUpperCase() ?? null;
}

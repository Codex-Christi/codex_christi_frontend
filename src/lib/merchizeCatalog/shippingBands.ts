import { normalizeCountryToIso2 } from '@/lib/utils/shop/checkout/normalizeCountryToIso3';
import type { SupplierShippingBand } from './currentEvidence';

export function selectSupplierShippingBand(
  bands: SupplierShippingBand[],
  zone: string,
  countryIso3: string,
) {
  const country = normalizeCountryToIso2(countryIso3);
  const candidates = bands.filter((b) => b.to_zone.toUpperCase() === zone);
  const exact = candidates.filter(
    (b) =>
      country &&
      (b.to_country ?? '')
        .toUpperCase()
        .split(/[,;\s]+/)
        .includes(country),
  );
  const rest = candidates.filter((b) => /^rest\b/i.test(b.to_country ?? ''));
  const defaults = candidates.filter((b) => !b.to_country || b.to_country.toLowerCase() === 'all');
  const selected = exact.length ? exact : rest.length ? rest : defaults;
  const prices = new Map(
    selected.map((b) => [
      JSON.stringify([
        b.first_item ?? b.first_item_price ?? null,
        b.additional_item ?? b.additional_item_price ?? null,
      ]),
      b,
    ]),
  );
  if (prices.size > 1)
    throw new Error('Supplier returned conflicting shipping bands for this destination.');
  return prices.values().next().value as SupplierShippingBand | undefined;
}

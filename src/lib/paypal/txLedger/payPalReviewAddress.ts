import { normalizeCountryToIso2 } from '@/lib/utils/shop/checkout/normalizeCountryToIso3';
import { normalizeUsState } from '@/lib/shop/address/usStates';

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const text = (value: unknown) =>
  typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ').toLowerCase() : '';
const postal = (value: unknown) => text(value).replace(/[\s-]+/gu, '');
const country = (value: unknown) => normalizeCountryToIso2(text(value)) ?? '';
const region = (value: unknown, countryCode: string) => {
  const normalized = text(value);
  return countryCode === 'US' ? (normalizeUsState(normalized) ?? normalized) : normalized;
};

function savedAddress(value: unknown) {
  const address = record(value);
  const countryCode = country(address?.shipping_country);
  return {
    street: text(address?.shipping_address_line_1),
    apartment: text(address?.shipping_address_line_2),
    city: text(address?.shipping_city),
    region: region(address?.shipping_state, countryCode),
    postalCode: postal(address?.zip_code),
    country: countryCode,
  };
}

function returnedAddress(value: unknown) {
  const address = record(value);
  const countryCode = country(address?.countryCode ?? address?.country_code);
  return {
    street: text(address?.addressLine1 ?? address?.address_line_1),
    apartment: text(address?.addressLine2 ?? address?.address_line_2),
    city: text(address?.adminArea2 ?? address?.admin_area_2),
    region: region(address?.adminArea1 ?? address?.admin_area_1, countryCode),
    postalCode: postal(address?.postalCode ?? address?.postal_code),
    country: countryCode,
  };
}

/** Direct capture/webhook resources normally omit shipping; compare only an address PayPal returns. */
export function hasChangedPayPalReviewAddress(shippingSnapshot: unknown, payload: unknown) {
  const root = record(payload);
  const units = root?.purchaseUnits ?? root?.purchase_units;
  const shipping = Array.isArray(units)
    ? units.map((unit) => record(record(unit)?.shipping))
    : [record(root?.shipping)];
  const addresses = shipping
    .map((details) => details?.address)
    .filter((address) => address !== undefined && address !== null);
  if (!addresses.length) return false;

  const expected = savedAddress(shippingSnapshot);
  if (
    !expected.street ||
    !expected.city ||
    !expected.region ||
    !expected.postalCode ||
    !expected.country
  )
    return true;
  return addresses.some((address) => {
    const actual = returnedAddress(address);
    return (Object.keys(expected) as Array<keyof typeof expected>).some(
      (field) => expected[field] !== actual[field],
    );
  });
}

type JsonRecord = Record<string, unknown>;

export type MerchizeBuyerAddressExpectation = {
  address: string;
  address2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country_code: string;
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getBuyerAddress(payload: unknown) {
  const root = asRecord(payload);
  const data = asRecord(root?.data) ?? root;

  return (
    asRecord(data?.shipping_address) ??
    asRecord(data?.shipping_address_model) ??
    asRecord(root?.shipping_address) ??
    asRecord(root?.shipping_address_model) ??
    data
  );
}

function normalizeText(value: unknown) {
  return asString(value).replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

function normalizePostalCode(value: unknown) {
  return asString(value).replace(/[\s-]+/g, '').toUpperCase();
}

function normalizeCountryCode(value: unknown) {
  return asString(value).toUpperCase();
}

export function getMerchizeBuyerAddressMismatchFields(
  payload: unknown,
  expected: MerchizeBuyerAddressExpectation,
) {
  const address = getBuyerAddress(payload);
  if (!address) {
    return ['line1', 'line2', 'city', 'state', 'postalCode', 'countryCode'];
  }

  const mismatches: string[] = [];
  if (normalizeText(address.address) !== normalizeText(expected.address)) {
    mismatches.push('line1');
  }
  if (normalizeText(address.address2) !== normalizeText(expected.address2)) {
    mismatches.push('line2');
  }
  if (normalizeText(address.city) !== normalizeText(expected.city)) {
    mismatches.push('city');
  }
  if (normalizeText(address.state) !== normalizeText(expected.state)) {
    mismatches.push('state');
  }
  if (
    normalizePostalCode(address.postal_code ?? address.zip_code) !==
    normalizePostalCode(expected.postal_code)
  ) {
    mismatches.push('postalCode');
  }
  if (
    normalizeCountryCode(address.country_code) !== normalizeCountryCode(expected.country_code)
  ) {
    mismatches.push('countryCode');
  }

  return mismatches;
}

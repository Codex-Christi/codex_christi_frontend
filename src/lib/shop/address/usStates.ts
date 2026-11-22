import { normalizeCountryToIso3 } from '@/lib/utils/shop/checkout/normalizeCountryToIso3';

/** U.S. postal regions, including territories and military addresses already supported by the shop. */
export const US_STATE_OPTIONS = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'AS', name: 'American Samoa' },
  { code: 'GU', name: 'Guam' },
  { code: 'MP', name: 'Northern Mariana Islands' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'VI', name: 'U.S. Virgin Islands' },
  { code: 'AA', name: 'Armed Forces Americas' },
  { code: 'AE', name: 'Armed Forces Europe' },
  { code: 'AP', name: 'Armed Forces Pacific' },
] as const;

export type UsStateCode = (typeof US_STATE_OPTIONS)[number]['code'];

const normalizedText = (value?: string | null) =>
  value?.trim().replace(/\s+/gu, ' ').toUpperCase() ?? '';
const codeByAlias = new Map<string, UsStateCode>();
for (const { code, name } of US_STATE_OPTIONS) {
  codeByAlias.set(code, code);
  codeByAlias.set(normalizedText(name), code);
}

export function normalizeUsState(value?: string | null): UsStateCode | null {
  return codeByAlias.get(normalizedText(value)) ?? null;
}

function countryIdentity(country?: string | null) {
  const value = normalizedText(country);
  return normalizeCountryToIso3(value) ?? value;
}

export function isUsCountry(country?: string | null) {
  return countryIdentity(country) === 'USA';
}

/** Invalid U.S. entries stay empty for form validation; other countries retain free text. */
export function normalizeShippingState(country?: string | null, value?: string | null) {
  return isUsCountry(country) ? (normalizeUsState(value) ?? '') : (value?.trim() ?? '');
}

/** Keep a state only when it still belongs to the selected country. */
export function stateAfterCountryChange(
  previousCountry?: string | null,
  nextCountry?: string | null,
  currentState?: string | null,
) {
  return countryIdentity(previousCountry) === countryIdentity(nextCountry)
    ? normalizeShippingState(nextCountry, currentState)
    : '';
}

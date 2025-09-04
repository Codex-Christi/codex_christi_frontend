import type { DestKey } from './shipping.types';

// EU-27 ISO3
const EU_ISO3 = new Set([
  'AUT',
  'BEL',
  'BGR',
  'HRV',
  'CYP',
  'CZE',
  'DNK',
  'EST',
  'FIN',
  'FRA',
  'DEU',
  'GRC',
  'HUN',
  'IRL',
  'ITA',
  'LVA',
  'LTU',
  'LUX',
  'MLT',
  'NLD',
  'POL',
  'PRT',
  'ROU',
  'SVK',
  'SVN',
  'ESP',
  'SWE',
]);

export function iso3ToDest(iso3: string): DestKey {
  const c = (iso3 || '').toUpperCase();
  if (c === 'USA') return 'US';
  if (c === 'CAN') return 'CA';
  if (c === 'AUS') return 'AU';
  if (c === 'GBR') return 'GB';
  if (EU_ISO3.has(c)) return 'EU';
  return 'ROW';
}

// USPS territories & military “states”
const US_TERR_OR_MIL = new Set(['HI', 'AK', 'PR', 'VI', 'GU', 'AS', 'MP', 'AA', 'AE', 'AP']);
export function isUSPostServiceSurchargeState(state?: string) {
  return !!state && US_TERR_OR_MIL.has(state.toUpperCase());
}

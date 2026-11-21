import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// Keep this list aligned with the public settings reviewed for the live source.
export const PUBLIC_KEYS = Object.freeze([
  'NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_SHOP_SITE_URL', 'NEXT_PUBLIC_DJANGO_API_BASE_URL',
  'NEXT_PUBLIC_PAYPAL_PAYMENT_MODE', 'NEXT_PUBLIC_PAYPAL_LIVE_CLIENT_ID',
  'NEXT_PUBLIC_PAYPAL_SANDBOX_CLIENT_ID', 'NEXT_PUBLIC_CART_KEY',
  'NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_ORG_TOKEN',
  'NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_SHOP_TOKEN',
]);
const approvedUrls = {
  NEXT_PUBLIC_SITE_URL: ['https://codexchristi.org', 'https://www.codexchristi.org'],
  NEXT_PUBLIC_SHOP_SITE_URL: ['https://codexchristi.shop', 'https://www.codexchristi.shop'],
  NEXT_PUBLIC_DJANGO_API_BASE_URL: ['https://codexchristi.org/api', 'https://codexchristi.org/api/v1',
    'https://www.codexchristi.org/api', 'https://www.codexchristi.org/api/v1'],
};
const failure = 'Release settings check failed; compiled public settings and runtime payment configuration must match.';
function requireSetting(condition) {
  if (!condition) throw new Error(failure);
}

export function validatePublicSettings(settings) {
  requireSetting(settings !== null && typeof settings === 'object' && !Array.isArray(settings));
  const result = {};
  for (const key of Object.keys(settings).sort()) {
    const value = settings[key];
    requireSetting(PUBLIC_KEYS.includes(key) && typeof value === 'string' && value.length <= 4096
      && !/[\x00-\x1f\x7f$`]/.test(value));
    result[key] = value;
  }
  for (const [key, approved] of Object.entries(approvedUrls)) {
    const value = result[key];
    requireSetting(typeof value === 'string'
      && approved.includes(value.endsWith('/') ? value.slice(0, -1) : value));
  }
  const mode = result.NEXT_PUBLIC_PAYPAL_PAYMENT_MODE;
  requireSetting(mode === 'sandbox' || mode === 'live');
  requireSetting(/^[A-Za-z0-9_-]{1,512}$/.test(result[`NEXT_PUBLIC_PAYPAL_${mode.toUpperCase()}_CLIENT_ID`] ?? ''));
  requireSetting(Boolean(result.NEXT_PUBLIC_CART_KEY));
  return result;
}

export function validateRuntimeSettings(compiled, environment) {
  const approved = validatePublicSettings(compiled);
  const actual = validatePublicSettings(Object.fromEntries(PUBLIC_KEYS
    .filter((key) => Object.hasOwn(environment, key))
    .map((key) => [key, environment[key]])));
  requireSetting(JSON.stringify(actual) === JSON.stringify(approved));
  const mode = approved.NEXT_PUBLIC_PAYPAL_PAYMENT_MODE;
  requireSetting(environment.PAYPAL_PAYMENT_MODE === mode
    && environment[`PAYPAL_${mode.toUpperCase()}_CLIENT_ID`]
      === approved[`NEXT_PUBLIC_PAYPAL_${mode.toUpperCase()}_CLIENT_ID`]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    requireSetting(process.argv.length === 3 && process.argv[2] === '--runtime');
    const compiled = JSON.parse(readFileSync(new URL('../release-public-settings.json', import.meta.url), 'utf8'));
    validateRuntimeSettings(compiled, process.env);
    console.log('Release public settings=OK; runtime payment configuration=matched');
  } catch {
    // Environment and parser errors can contain credentials or values. Print only this fixed diagnostic.
    console.error(failure);
    process.exitCode = 1;
  }
}

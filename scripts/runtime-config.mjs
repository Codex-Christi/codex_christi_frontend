// This module is shared by the running application and its deployment preflight.
// It never reads configuration at import time or exposes the environment itself.

const approvedUrls = Object.freeze({
  SITE_URL: ['https://codexchristi.org', 'https://www.codexchristi.org'],
  SHOP_SITE_URL: ['https://codexchristi.shop', 'https://www.codexchristi.shop'],
  DJANGO_API_BASE_URL: [
    'https://codexchristi.org/api',
    'https://codexchristi.org/api/v1',
    'https://www.codexchristi.org/api',
    'https://www.codexchristi.org/api/v1',
  ],
});

const invalidConfiguration = 'Runtime configuration is invalid.';
const unsafeCharacters = /[\x00-\x1f\x7f-\x9f$`\u2028\u2029]/;

/** @returns {never} */
function fail() {
  throw new Error(invalidConfiguration);
}

/**
 * Existing VPS installations can keep their original variable names. A new name
 * can replace its legacy alias, but conflicting values must not be used.
 * @param {Record<string, string | undefined>} environment
 * @param {string} canonicalKey
 * @param {string} legacyKey
 */
export function readRuntimeSetting(environment, canonicalKey, legacyKey) {
  const canonical = environment[canonicalKey];
  const legacy = environment[legacyKey];
  if (canonical !== undefined && legacy !== undefined && canonical !== legacy) fail();
  const value = canonical ?? legacy;
  if (value !== undefined && typeof value !== 'string') fail();
  return value;
}

/** @param {string | undefined} value */
function requiredString(value) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > 4096 ||
    unsafeCharacters.test(value)
  ) {
    fail();
  }
  return value;
}

/**
 * @param {Record<string, string | undefined>} environment
 * @param {keyof typeof approvedUrls} key
 */
function readApprovedUrl(environment, key) {
  const value = requiredString(readRuntimeSetting(environment, key, `NEXT_PUBLIC_${key}`));
  if (!approvedUrls[key].includes(value.replace(/\/$/, ''))) fail();
  return value;
}

/** @param {string | undefined} value */
function optionalAnalyticsToken(value) {
  if (value === undefined || value === '') return null;
  const token = requiredString(value);
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(token)) fail();
  return token;
}

/** @param {Record<string, string | undefined>} environment */
function readPayPalConfiguration(environment) {
  // The server's authoritative payment configuration also determines the browser
  // client ID. Existing public aliases, where present, must still agree.
  const paymentMode = environment.PAYPAL_PAYMENT_MODE;
  if (paymentMode !== 'sandbox' && paymentMode !== 'live') fail();
  const legacyMode = environment['NEXT_PUBLIC_PAYPAL_PAYMENT_MODE'];
  if (legacyMode !== undefined && legacyMode !== paymentMode) fail();

  const clientIdKey = `PAYPAL_${paymentMode.toUpperCase()}_CLIENT_ID`;
  const paymentClientId = requiredString(environment[clientIdKey]);
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(paymentClientId)) fail();
  const legacyClientId = environment[`NEXT_PUBLIC_${clientIdKey}`];
  if (legacyClientId !== undefined && legacyClientId !== paymentClientId) fail();
  return { paymentMode, paymentClientId };
}

/** @param {Record<string, string | undefined>} environment */
export function getRuntimeConfiguration(environment) {
  const siteUrl = readApprovedUrl(environment, 'SITE_URL');
  const shopSiteUrl = readApprovedUrl(environment, 'SHOP_SITE_URL');
  const djangoApiBaseUrl = readApprovedUrl(environment, 'DJANGO_API_BASE_URL');
  const { paymentMode, paymentClientId } = readPayPalConfiguration(environment);
  const cartKey = requiredString(
    readRuntimeSetting(environment, 'CART_STORAGE_OBFUSCATION_KEY', 'NEXT_PUBLIC_CART_KEY'),
  );
  const analyticsOrgToken = optionalAnalyticsToken(
    readRuntimeSetting(
      environment,
      'CLOUDFLARE_WEB_ANALYTICS_ORG_TOKEN',
      'NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_ORG_TOKEN',
    ),
  );
  const analyticsShopToken = optionalAnalyticsToken(
    readRuntimeSetting(
      environment,
      'CLOUDFLARE_WEB_ANALYTICS_SHOP_TOKEN',
      'NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_SHOP_TOKEN',
    ),
  );
  return {
    siteUrl,
    shopSiteUrl,
    djangoApiBaseUrl,
    paymentMode,
    paymentClientId,
    cartKey,
    analyticsOrgToken,
    analyticsShopToken,
  };
}

/** @param {Record<string, string | undefined>} environment */
export function getPublicRuntimeConfig(environment) {
  const configuration = getRuntimeConfiguration(environment);
  // Never spread the runtime configuration or the environment into a response.
  // The cart key is browser-storage obfuscation, not a private encryption key.
  return {
    siteUrl: configuration.siteUrl,
    shopSiteUrl: configuration.shopSiteUrl,
    paymentMode: configuration.paymentMode,
    paymentClientId: configuration.paymentClientId,
    cartKey: configuration.cartKey,
    analyticsOrgToken: configuration.analyticsOrgToken,
    analyticsShopToken: configuration.analyticsShopToken,
  };
}

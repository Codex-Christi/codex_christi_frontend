import assert from 'node:assert/strict';
import test from 'node:test';
import { getPublicRuntimeConfig, getRuntimeConfiguration, readRuntimeSetting } from '../runtime-config.mjs';

function legacyEnvironment(mode = 'sandbox') {
  return {
    NEXT_PUBLIC_SITE_URL: 'https://codexchristi.org',
    NEXT_PUBLIC_SHOP_SITE_URL: 'https://codexchristi.shop/',
    NEXT_PUBLIC_DJANGO_API_BASE_URL: 'https://codexchristi.org/api/v1',
    PAYPAL_PAYMENT_MODE: mode,
    NEXT_PUBLIC_PAYPAL_PAYMENT_MODE: mode,
    [`PAYPAL_${mode.toUpperCase()}_CLIENT_ID`]: 'client-fixture',
    [`NEXT_PUBLIC_PAYPAL_${mode.toUpperCase()}_CLIENT_ID`]: 'client-fixture',
    NEXT_PUBLIC_CART_KEY: 'cart-fixture',
  };
}

function canonicalEnvironment(mode = 'live') {
  return {
    SITE_URL: 'https://www.codexchristi.org/',
    SHOP_SITE_URL: 'https://www.codexchristi.shop',
    DJANGO_API_BASE_URL: 'https://www.codexchristi.org/api/',
    PAYPAL_PAYMENT_MODE: mode,
    [`PAYPAL_${mode.toUpperCase()}_CLIENT_ID`]: 'client-fixture-two',
    CART_STORAGE_OBFUSCATION_KEY: 'cart-fixture-two',
    CLOUDFLARE_WEB_ANALYTICS_ORG_TOKEN: 'org-fixture',
    CLOUDFLARE_WEB_ANALYTICS_SHOP_TOKEN: 'shop-fixture',
  };
}

function rejects(environment) {
  assert.throws(() => getPublicRuntimeConfig(environment), { message: 'Runtime configuration is invalid.' });
}

test('legacy settings remain compatible without any image build values', () => {
  const environment = legacyEnvironment();
  assert.deepEqual(getPublicRuntimeConfig(environment), {
    siteUrl: 'https://codexchristi.org',
    shopSiteUrl: 'https://codexchristi.shop/',
    paymentMode: 'sandbox',
    paymentClientId: 'client-fixture',
    cartKey: 'cart-fixture',
    analyticsOrgToken: null,
    analyticsShopToken: null,
  });
  assert.equal(getRuntimeConfiguration(environment).djangoApiBaseUrl, environment.NEXT_PUBLIC_DJANGO_API_BASE_URL);
});

test('canonical runtime settings require no NEXT_PUBLIC variables', () => {
  const environment = canonicalEnvironment();
  assert.deepEqual(getPublicRuntimeConfig(environment), {
    siteUrl: 'https://www.codexchristi.org/',
    shopSiteUrl: 'https://www.codexchristi.shop',
    paymentMode: 'live',
    paymentClientId: 'client-fixture-two',
    cartKey: 'cart-fixture-two',
    analyticsOrgToken: 'org-fixture',
    analyticsShopToken: 'shop-fixture',
  });
});

test('public projection omits Django URL, inactive PayPal ID, arbitrary public names and all credentials', () => {
  for (const paymentMode of ['sandbox', 'live']) {
    const inactiveMode = paymentMode === 'sandbox' ? 'LIVE' : 'SANDBOX';
    const config = getPublicRuntimeConfig({
      ...legacyEnvironment(paymentMode),
      [`PAYPAL_${inactiveMode}_CLIENT_ID`]: 'inactive-id-never-expose',
      [`NEXT_PUBLIC_PAYPAL_${inactiveMode}_CLIENT_ID`]: 'inactive-id-never-expose',
      PAYPAL_SANDBOX_CLIENT_SECRET: 'private-credential-fixture',
      DJANGO_INTERNAL_BASE_URL: 'http://internal-fixture',
      NEXT_PUBLIC_UNAPPROVED: 'unapproved-fixture',
      DATABASE_URL: 'database-fixture',
    });
    const serialized = JSON.stringify(config);
    assert.equal(Object.keys(config).length, 7);
    assert.equal(config.paymentMode, paymentMode);
    for (const excluded of ['/api/v1', 'inactive-id-never-expose', 'private-credential-fixture', 'internal-fixture', 'unapproved-fixture', 'database-fixture']) {
      assert.ok(!serialized.includes(excluded));
    }
  }
});

test('runtime aliases agree or are rejected instead of choosing one silently', () => {
  const environment = legacyEnvironment();
  const canonicalToLegacy = {
    SITE_URL: 'NEXT_PUBLIC_SITE_URL',
    SHOP_SITE_URL: 'NEXT_PUBLIC_SHOP_SITE_URL',
    DJANGO_API_BASE_URL: 'NEXT_PUBLIC_DJANGO_API_BASE_URL',
    CART_STORAGE_OBFUSCATION_KEY: 'NEXT_PUBLIC_CART_KEY',
  };
  for (const [canonical, legacy] of Object.entries(canonicalToLegacy)) {
    const both = { ...environment, [canonical]: environment[legacy] };
    assert.deepEqual(getPublicRuntimeConfig(both), getPublicRuntimeConfig(environment));
    rejects({ ...both, [canonical]: 'conflicting-fixture' });
  }
  rejects({ ...environment, PAYPAL_PAYMENT_MODE: 'live', PAYPAL_LIVE_CLIENT_ID: 'live-fixture' });
  rejects({ ...environment, PAYPAL_SANDBOX_CLIENT_ID: 'other-fixture' });
  rejects({ ...environment, CLOUDFLARE_WEB_ANALYTICS_ORG_TOKEN: 'first', NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_ORG_TOKEN: 'second' });
});

test('missing required settings, unsafe values and unapproved origins fail closed without echoing inputs', () => {
  const canonical = canonicalEnvironment();
  for (const key of Object.keys(canonical).filter((key) => !key.startsWith('CLOUDFLARE_'))) {
    const environment = { ...canonical };
    delete environment[key];
    rejects(environment);
  }
  const invalidSettings = {
    SITE_URL: ['https://codexchristi.org.evil.invalid', 'https://codexchristi.org/#private-fixture', 'http://codexchristi.org'],
    SHOP_SITE_URL: ['https://codexchristi.shop/unapproved'],
    DJANGO_API_BASE_URL: ['https://codexchristi.org/api?private=fixture'],
    PAYPAL_PAYMENT_MODE: ['invalid', 'LIVE'],
    PAYPAL_LIVE_CLIENT_ID: ['bad fixture', 'bad\nfixture'],
    CART_STORAGE_OBFUSCATION_KEY: [' ', 'x'.repeat(4097), 'unsafe\nfixture', 'unsafe$fixture'],
    CLOUDFLARE_WEB_ANALYTICS_ORG_TOKEN: ['invalid token', 'private.fixture'],
  };
  for (const [key, values] of Object.entries(invalidSettings)) {
    for (const value of values) rejects({ ...canonical, [key]: value });
  }
  rejects({ ...legacyEnvironment(), PAYPAL_SANDBOX_CLIENT_ID: undefined });
  rejects({ ...legacyEnvironment(), PAYPAL_PAYMENT_MODE: undefined });
});

test('optional analytics can be empty and alias lookup does not require unavailable build values', () => {
  const environment = { ...legacyEnvironment(), NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_ORG_TOKEN: '' };
  assert.equal(getPublicRuntimeConfig(environment).analyticsOrgToken, null);
  assert.equal(readRuntimeSetting({}, 'SITE_URL', 'NEXT_PUBLIC_SITE_URL'), undefined);
  assert.equal(readRuntimeSetting(environment, 'SITE_URL', 'NEXT_PUBLIC_SITE_URL'), environment.NEXT_PUBLIC_SITE_URL);
});

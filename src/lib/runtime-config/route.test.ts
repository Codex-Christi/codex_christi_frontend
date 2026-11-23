import assert from 'node:assert/strict';
import test from 'node:test';
import { GET } from '@/app/api/runtime-config/route';

test('runtime route reads current configuration and returns only the approved public values with no-store', async (t) => {
  // Do not read private configuration from files or depend on the test host's env.
  const previous = process.env;
  process.env = {
    NODE_ENV: 'test',
    SITE_URL: 'https://codexchristi.org',
    SHOP_SITE_URL: 'https://codexchristi.shop',
    DJANGO_API_BASE_URL: 'https://codexchristi.org/api/v1',
    PAYPAL_PAYMENT_MODE: 'sandbox',
    PAYPAL_SANDBOX_CLIENT_ID: 'sandbox-fixture',
    PAYPAL_LIVE_CLIENT_ID: 'live-fixture',
    PAYPAL_SANDBOX_CLIENT_SECRET: 'private-fixture',
    CART_STORAGE_OBFUSCATION_KEY: 'cart-fixture',
  };
  t.after(() => {
    process.env = previous;
  });

  const sandbox = await GET();
  assert.equal(sandbox.status, 200);
  assert.equal(sandbox.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await sandbox.json(), {
    siteUrl: 'https://codexchristi.org',
    shopSiteUrl: 'https://codexchristi.shop',
    paymentMode: 'sandbox',
    paymentClientId: 'sandbox-fixture',
    cartKey: 'cart-fixture',
    analyticsOrgToken: null,
    analyticsShopToken: null,
  });

  process.env.PAYPAL_PAYMENT_MODE = 'live';
  process.env.SITE_URL = 'https://www.codexchristi.org';
  process.env.CART_STORAGE_OBFUSCATION_KEY = 'changed-cart-fixture';
  const live = await GET();
  assert.equal(live.status, 200);
  assert.deepEqual(await live.json(), {
    siteUrl: 'https://www.codexchristi.org',
    shopSiteUrl: 'https://codexchristi.shop',
    paymentMode: 'live',
    paymentClientId: 'live-fixture',
    cartKey: 'changed-cart-fixture',
    analyticsOrgToken: null,
    analyticsShopToken: null,
  });

  process.env.NEXT_PUBLIC_PAYPAL_LIVE_CLIENT_ID = 'private-mismatch-fixture';
  const invalid = await GET();
  assert.equal(invalid.status, 503);
  assert.equal(invalid.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await invalid.json(), { status: 'unavailable' });
});

test('invalid runtime settings stop readiness before authentication or catalog checks', async (t) => {
  const previous = process.env;
  process.env = { NODE_ENV: 'test', PAYPAL_PAYMENT_MODE: 'private-invalid-fixture' };
  const warnings: unknown[][] = [];
  t.mock.method(console, 'warn', (...args: unknown[]) => warnings.push(args));
  t.after(() => {
    process.env = previous;
  });

  const { GET: readiness } = await import('@/app/api/health/ready/route');
  const response = await readiness();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { status: 'unavailable' });
  assert.deepEqual(warnings, [['[readiness] runtime configuration is unavailable']]);
});

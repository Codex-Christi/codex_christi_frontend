import assert from 'node:assert/strict';
import test from 'node:test';
import { getPublicPayPalOptions } from '@/lib/paypal/publicPayPalConfig';
import type { PublicRuntimeConfig } from '@/lib/runtime-config/client';

const runtimeConfig: PublicRuntimeConfig = {
  siteUrl: 'https://codexchristi.org',
  shopSiteUrl: 'https://codexchristi.shop',
  paymentMode: 'sandbox',
  paymentClientId: 'sandbox-fixture-id',
  cartKey: 'cart-fixture',
  analyticsOrgToken: null,
  analyticsShopToken: null,
};

test('PayPal SDK options are unavailable until runtime configuration and the checkout currency exist', () => {
  assert.equal(getPublicPayPalOptions(null, 'USD', 'US'), null);
  assert.equal(getPublicPayPalOptions(runtimeConfig, undefined, 'US'), null);
});

test('each payment configuration supplies its own public client ID while retaining review currency and country', () => {
  const sandbox = getPublicPayPalOptions(runtimeConfig, 'USD', 'US');
  const live = getPublicPayPalOptions(
    { ...runtimeConfig, paymentMode: 'live', paymentClientId: 'live-fixture-id' },
    'GBP',
    'GB',
  );
  assert.equal(sandbox?.clientId, 'sandbox-fixture-id');
  assert.equal(sandbox?.intent, 'authorize');
  assert.equal(live?.clientId, 'live-fixture-id');
  assert.equal(live?.currency, 'GBP');
  assert.equal(live?.['buyer-country'], 'GB');
  assert.equal(getPublicPayPalOptions(runtimeConfig, 'USD', undefined)?.['buyer-country'], 'US');
});

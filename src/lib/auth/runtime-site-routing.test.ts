import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { getAuthRoutes, publicShopPath } from './domain-routing';
import { getAuthRoutes as getRuntimeAuthRoutes } from './domain-routing.server';
import { isSameOriginMutation } from './request-origin';
import { getMainSiteBaseUrl, getShopSiteHostname } from '../siteBaseUrls';
import { getMainSiteBaseUrl as getRuntimeMainSiteBaseUrl } from '../siteBaseUrls.server';
import { resolveServerDjangoApiBaseUrl } from '../django/resolveServerDjangoApiBaseUrl';
import { receiptDownloadPath, receiptObjectKey } from '../shop/orderHistory/receiptReference';
import { getCheckoutSurfaceProvenance } from '../paypal/txLedger/checkoutSurfaceProvenance';
import { getPayPalLedgerInferredProcessingSourceDisplay } from '../paypal/txLedger/paypalLedgerProvenance';

function setEnv(t: TestContext, key: string, value?: string) {
  const previous = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  t.after(() => {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  });
}

const siteOrigins = {
  siteUrl: 'https://www.codexchristi.org',
  shopSiteUrl: 'https://www.codexchristi.shop',
};

test('canonical metadata is independent of runtime values; server and client routing use selected origins', (t) => {
  setEnv(t, 'NODE_ENV', 'production');
  setEnv(t, 'SITE_URL');
  setEnv(t, 'SHOP_SITE_URL');
  setEnv(t, 'NEXT_PUBLIC_SITE_URL', siteOrigins.siteUrl);
  setEnv(t, 'NEXT_PUBLIC_SHOP_SITE_URL', siteOrigins.shopSiteUrl);
  assert.equal(getMainSiteBaseUrl(), 'https://codexchristi.org');
  assert.equal(getShopSiteHostname(), 'codexchristi.shop');
  assert.equal(getRuntimeMainSiteBaseUrl(), siteOrigins.siteUrl);
  assert.equal(getRuntimeAuthRoutes('codexchristi.shop').signup, `${siteOrigins.siteUrl}/auth/signup`);
  assert.equal(getAuthRoutes('codexchristi.shop', false, siteOrigins).signup, `${siteOrigins.siteUrl}/auth/signup`);
  assert.equal(publicShopPath('/shop/cart', 'codexchristi.shop', siteOrigins), '/cart');
  assert.equal(publicShopPath('/shop/cart', 'www.codexchristi.shop', siteOrigins), '/cart');
  assert.equal(publicShopPath('/shop/cart', 'codexchristi.shop.example', siteOrigins), '/shop/cart');
  setEnv(t, 'SITE_URL', 'https://codexchristi.org');
  assert.throws(() => getRuntimeMainSiteBaseUrl(), /Runtime configuration is invalid/);
});

test('production request origins permit exactly the approved aliases, including when www is selected', (t) => {
  setEnv(t, 'NODE_ENV', 'production');
  setEnv(t, 'SITE_URL', siteOrigins.siteUrl);
  setEnv(t, 'SHOP_SITE_URL', siteOrigins.shopSiteUrl);
  setEnv(t, 'NEXT_PUBLIC_SITE_URL');
  setEnv(t, 'NEXT_PUBLIC_SHOP_SITE_URL');
  const check = (host: string) => isSameOriginMutation(new Request(`https://${host}/api/logout`, {
    headers: { host, origin: `https://${host}` },
  }));
  for (const host of ['codexchristi.org', 'www.codexchristi.org', 'codexchristi.shop', 'www.codexchristi.shop']) {
    assert.equal(check(host), true, host);
  }
  for (const host of ['www.www.codexchristi.org', 'codexchristi.shop.example', 'sub.codexchristi.shop']) {
    assert.equal(check(host), false, host);
  }
});

test('server API base URL uses the runtime environment with internal preference and safe alias conflicts', (t) => {
  setEnv(t, 'NODE_ENV', 'production');
  setEnv(t, 'DJANGO_API_BASE_URL');
  setEnv(t, 'NEXT_PUBLIC_DJANGO_API_BASE_URL', 'https://codexchristi.org/api/v1/');
  setEnv(t, 'DJANGO_INTERNAL_BASE_URL');
  assert.equal(resolveServerDjangoApiBaseUrl(), 'https://codexchristi.org/api/v1');
  setEnv(t, 'DJANGO_INTERNAL_BASE_URL', 'http://internal.invalid:8000/api/');
  assert.equal(resolveServerDjangoApiBaseUrl(), 'http://internal.invalid:8000/api');
  setEnv(t, 'DJANGO_API_BASE_URL', 'https://www.codexchristi.org/api/v1');
  assert.throws(() => resolveServerDjangoApiBaseUrl(), /Runtime configuration is invalid/);
});

test('approved origin aliases preserve existing receipt links and provenance after runtime configuration changes', (t) => {
  setEnv(t, 'NODE_ENV', 'production');
  setEnv(t, 'SITE_URL', siteOrigins.siteUrl);
  setEnv(t, 'SHOP_SITE_URL', siteOrigins.shopSiteUrl);
  setEnv(t, 'NEXT_PUBLIC_SITE_URL');
  setEnv(t, 'NEXT_PUBLIC_SHOP_SITE_URL');
  const orderToken = 'fixture-order';
  const receiptFile = 'receipt-d73b4b97-3ec0-4163-8a34-55d649404f81';
  const row = { orderToken, receiptFile, receiptLink: `https://codexchristi.shop${receiptDownloadPath(orderToken)}` };
  assert.equal(receiptObjectKey(row), `paypal/${receiptFile}.pdf`);
  assert.equal(receiptObjectKey({ ...row, receiptLink: `https://sub.codexchristi.shop${receiptDownloadPath(orderToken)}` }), null);
  assert.equal(getCheckoutSurfaceProvenance(new Request('https://codexchristi.shop/api', {
    headers: { origin: 'https://codexchristi.shop' },
  })).checkoutSurfaceLabel, 'codexchristi.shop shop checkout');
  assert.equal(getPayPalLedgerInferredProcessingSourceDisplay({ hasCapturePayload: true, ledgerStatus: 'captured' }, siteOrigins)?.label,
    'www.codexchristi.shop checkout capture route');
});

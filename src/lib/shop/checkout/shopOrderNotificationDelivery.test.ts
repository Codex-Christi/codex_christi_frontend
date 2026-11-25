import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOrderNotificationDelivery } from '@/lib/shop/email/orderNotificationDelivery';

const fixtureUrl = 'postgresql://fixture:fixture@localhost:1/unused';
const buyer = 'buyer@example.test';
const orderToken = 'fixture/1';
const dev: NodeJS.ProcessEnv = {
  NODE_ENV: 'development',
  SHOP_OPS_DATA_TARGET: 'dev',
  PAYPAL_TX_LEDGER_NEON_POOLED_DB_DEV_STRING: fixtureUrl,
  MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_DEV_STRING: fixtureUrl,
  SHOP_DEV_ORDER_EMAIL_INBOX: 'test-inbox@example.test',
  SHOP_DEV_ORDER_CONFIRMATION_ORIGIN: 'http://localhost:3001',
};

test('development order mail uses the test inbox and the matching app origin', () => {
  const resolve = (env = dev) => resolveOrderNotificationDelivery(buyer, orderToken, env);
  assert.deepEqual(resolve(), {
    recipient: 'test-inbox@example.test',
    test: true,
    confirmationUrl: 'http://localhost:3001/shop/checkout/confirmation/fixture%2F1?view=details',
  });
  assert.equal(resolve({
    ...dev,
    SHOP_DEV_ORDER_CONFIRMATION_ORIGIN: 'https://test-shop.example.test/',
  })?.confirmationUrl, 'https://test-shop.example.test/shop/checkout/confirmation/fixture%2F1?view=details');
  for (const origin of [
    '', 'https://codexchristi.shop', 'https://www.codexchristi.org.',
    'http://test-shop.example.test', 'https://user:pass@example.test',
    'https://test-shop.example.test/wrong-path', 'https://test-shop.example.test/?next=other',
  ]) {
    assert.equal(resolve({ ...dev, SHOP_DEV_ORDER_CONFIRMATION_ORIGIN: origin }), null, origin);
  }
  assert.equal(resolve({ ...dev, SHOP_DEV_ORDER_EMAIL_INBOX: buyer + ',other@example.test' }), null);
  assert.equal(resolve({ ...dev, SHOP_DEV_ORDER_EMAIL_INBOX: '' }), null);
  assert.equal(resolve({ ...dev, SHOP_OPS_DATA_TARGET: 'invalid' }), null);
});

test('production sends normally, but local reads of production data cannot send order mail', () => {
  const prod: NodeJS.ProcessEnv = {
    ...dev,
    NODE_ENV: 'production',
    SHOP_OPS_DATA_TARGET: 'prod',
    PAYPAL_TX_LEDGER_NEON_POOLED_DB_STRING: fixtureUrl,
    MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_STRING: fixtureUrl,
  };
  assert.deepEqual(resolveOrderNotificationDelivery(buyer, orderToken, prod), {
    recipient: buyer,
    test: false,
  });
  assert.equal(resolveOrderNotificationDelivery(buyer, orderToken, {
    ...prod, NODE_ENV: 'development', SHOP_OPS_ALLOW_LOCAL_PRODUCTION_MUTATIONS: 'true',
  }), null);
});

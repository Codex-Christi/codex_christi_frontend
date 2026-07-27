import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeShopOpsDataTarget, resolveShopOpsDataTarget } from './shopOpsDataTarget';

test('uses the canonical target when legacy selectors agree', () => {
  const status = resolveShopOpsDataTarget({
    NODE_ENV: 'development',
    SHOP_OPS_DATA_TARGET: 'prod',
    PAYPAL_TX_LEDGER_NEON_BRANCH: 'prod',
    MERCHIZE_FULFILLMENT_OPS_NEON_BRANCH: 'prod',
    PAYPAL_TX_LEDGER_NEON_POOLED_DB_STRING: 'postgresql://paypal-prod',
    MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_STRING: 'postgresql://merchize-prod',
  });

  assert.equal(status.target, 'prod');
  assert.equal(status.source, 'canonical');
  assert.equal(status.aligned, true);
  assert.equal(status.isLocalProductionTarget, true);
});

test('canonical target overrides legacy runtime selectors', () => {
  const status = resolveShopOpsDataTarget({
    NODE_ENV: 'production',
    SHOP_OPS_DATA_TARGET: 'prod',
    PAYPAL_TX_LEDGER_NEON_BRANCH: 'dev',
    MERCHIZE_FULFILLMENT_OPS_NEON_BRANCH: 'prod',
    PAYPAL_TX_LEDGER_NEON_POOLED_DB_STRING: 'postgresql://paypal-prod',
    MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_STRING: 'postgresql://merchize-prod',
  });

  assert.equal(status.target, 'prod');
  assert.equal(status.aligned, true);
  assert.equal(status.source, 'canonical');
});

test('supports aligned legacy selectors during migration', () => {
  const status = resolveShopOpsDataTarget({
    NODE_ENV: 'development',
    PAYPAL_TX_LEDGER_NEON_BRANCH: 'dev',
    MERCHIZE_FULFILLMENT_OPS_NEON_BRANCH: 'dev',
    PAYPAL_TX_LEDGER_NEON_POOLED_DB_DEV_STRING: 'postgresql://paypal-dev',
    MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_DEV_STRING: 'postgresql://merchize-dev',
  });

  assert.equal(status.target, 'dev');
  assert.equal(status.source, 'legacy_aligned');
  assert.equal(status.aligned, true);
});

test('does not infer a target from only one legacy selector', () => {
  const status = resolveShopOpsDataTarget({
    NODE_ENV: 'development',
    PAYPAL_TX_LEDGER_NEON_BRANCH: 'prod',
  });

  assert.equal(status.target, null);
  assert.equal(status.aligned, false);
  assert.match(status.configurationError ?? '', /both be present and equal/i);
});

test('local production mutations are opt-in', () => {
  const disabled = resolveShopOpsDataTarget({
    NODE_ENV: 'development',
    SHOP_OPS_DATA_TARGET: 'prod',
    PAYPAL_TX_LEDGER_NEON_POOLED_DB_STRING: 'postgresql://paypal-prod',
    MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_STRING: 'postgresql://merchize-prod',
  });
  const enabled = resolveShopOpsDataTarget({
    NODE_ENV: 'development',
    SHOP_OPS_DATA_TARGET: 'prod',
    SHOP_OPS_ALLOW_LOCAL_PRODUCTION_MUTATIONS: 'true',
    PAYPAL_TX_LEDGER_NEON_POOLED_DB_STRING: 'postgresql://paypal-prod',
    MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_STRING: 'postgresql://merchize-prod',
  });

  assert.equal(disabled.localProductionMutationsEnabled, false);
  assert.equal(enabled.localProductionMutationsEnabled, true);
});

test('fails closed when one selected runtime database URL is missing', () => {
  const status = resolveShopOpsDataTarget({
    NODE_ENV: 'production',
    SHOP_OPS_DATA_TARGET: 'prod',
    PAYPAL_TX_LEDGER_NEON_POOLED_DB_STRING: 'postgresql://paypal-prod',
  });

  assert.equal(status.aligned, false);
  assert.match(status.configurationError ?? '', /Merchize Fulfillment Ops/i);
});

test('normalizes supported target values only', () => {
  assert.equal(normalizeShopOpsDataTarget(' DEV '), 'dev');
  assert.equal(normalizeShopOpsDataTarget('production'), null);
});

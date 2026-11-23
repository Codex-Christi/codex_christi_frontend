import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { validateRuntimeSettings } from '../check-release-settings.mjs';

function legacyEnvironment(mode = 'sandbox') {
  const clientId = `public-${mode}-fixture`;
  return {
    NEXT_PUBLIC_SITE_URL: 'https://codexchristi.org',
    NEXT_PUBLIC_SHOP_SITE_URL: 'https://codexchristi.shop',
    NEXT_PUBLIC_DJANGO_API_BASE_URL: 'https://codexchristi.org/api/v1',
    NEXT_PUBLIC_PAYPAL_PAYMENT_MODE: mode,
    [`NEXT_PUBLIC_PAYPAL_${mode.toUpperCase()}_CLIENT_ID`]: clientId,
    NEXT_PUBLIC_CART_KEY: 'cart-fixture',
    PAYPAL_PAYMENT_MODE: mode,
    [`PAYPAL_${mode.toUpperCase()}_CLIENT_ID`]: clientId,
    SESSION_SECRET: 'private-fixture-must-not-be-reported',
    PAYPAL_SANDBOX_CLIENT_SECRET: 'private-client-secret-fixture',
    NEXT_PUBLIC_UNREVIEWED_LEGACY_SETTING: 'existing-runtime-only-fixture',
  };
}

function canonicalEnvironment() {
  return {
    SITE_URL: 'https://www.codexchristi.org',
    SHOP_SITE_URL: 'https://www.codexchristi.shop',
    DJANGO_API_BASE_URL: 'https://www.codexchristi.org/api/v1',
    PAYPAL_PAYMENT_MODE: 'live',
    PAYPAL_LIVE_CLIENT_ID: 'public-live-fixture',
    CART_STORAGE_OBFUSCATION_KEY: 'another-cart-fixture',
    CLOUDFLARE_WEB_ANALYTICS_ORG_TOKEN: 'org-fixture',
    SESSION_SECRET: 'private-fixture-must-not-be-reported',
    PAYPAL_LIVE_CLIENT_SECRET: 'private-client-secret-fixture',
  };
}

test('runtime settings can be validated without build-time values or an embedded manifest', () => {
  for (const environment of [legacyEnvironment(), legacyEnvironment('live'), canonicalEnvironment()]) {
    const before = { ...environment };
    assert.equal(validateRuntimeSettings(environment), undefined);
    assert.deepEqual(environment, before);
  }
});

test('the release preflight rejects invalid runtime settings and payment mismatches', () => {
  const environment = legacyEnvironment();
  for (const changes of [
    { NEXT_PUBLIC_SITE_URL: 'https://example.invalid' },
    { NEXT_PUBLIC_CART_KEY: '' },
    { PAYPAL_PAYMENT_MODE: 'live' },
    { PAYPAL_SANDBOX_CLIENT_ID: 'private-mismatch-fixture' },
    { PAYPAL_SANDBOX_CLIENT_ID: '' },
  ]) {
    assert.throws(() => validateRuntimeSettings({ ...environment, ...changes }));
  }
});

test('the standalone runtime CLI does not require an embedded manifest or application dependencies', () => {
  const folder = realpathSync(mkdtempSync(path.join(tmpdir(), 'release-settings-test-')));
  try {
    mkdirSync(path.join(folder, 'scripts'));
    const script = path.join(folder, 'scripts/check-release-settings.mjs');
    copyFileSync(new URL('../check-release-settings.mjs', import.meta.url), script);
    copyFileSync(new URL('../runtime-config.mjs', import.meta.url), path.join(folder, 'scripts/runtime-config.mjs'));

    for (const environment of [legacyEnvironment(), canonicalEnvironment()]) {
      const result = spawnSync(process.execPath, [script, '--runtime'], {
        cwd: folder, env: environment, encoding: 'utf8', timeout: 5000,
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), 'Release runtime settings=OK; runtime payment configuration=matched');
      assert.equal(result.stderr, '');
    }

    for (const args of [['--runtime'], ['invalid-private-fixture']]) {
      const result = spawnSync(process.execPath, [script, ...args], {
        cwd: folder, env: { ...legacyEnvironment(), PAYPAL_PAYMENT_MODE: 'private-mismatch-fixture' },
        encoding: 'utf8', timeout: 5000,
      });
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.equal(result.stderr.trim(), 'Release settings check failed; runtime configuration is invalid.');
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

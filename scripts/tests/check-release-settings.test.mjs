import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { PUBLIC_KEYS, validatePublicSettings, validateRuntimeSettings } from '../check-release-settings.mjs';

function settings(mode = 'sandbox') {
  return {
    NEXT_PUBLIC_SITE_URL: 'https://codexchristi.org',
    NEXT_PUBLIC_SHOP_SITE_URL: 'https://codexchristi.shop',
    NEXT_PUBLIC_DJANGO_API_BASE_URL: 'https://codexchristi.org/api/v1',
    NEXT_PUBLIC_PAYPAL_PAYMENT_MODE: mode,
    [`NEXT_PUBLIC_PAYPAL_${mode.toUpperCase()}_CLIENT_ID`]: 'public-client-fixture',
    NEXT_PUBLIC_CART_KEY: 'cart-fixture',
  };
}
function environment(publicSettings) {
  const mode = publicSettings.NEXT_PUBLIC_PAYPAL_PAYMENT_MODE;
  return { ...publicSettings, PAYPAL_PAYMENT_MODE: mode,
    [`PAYPAL_${mode.toUpperCase()}_CLIENT_ID`]: publicSettings[`NEXT_PUBLIC_PAYPAL_${mode.toUpperCase()}_CLIENT_ID`],
    SESSION_SECRET: 'private-fixture-must-not-be-reported',
    PAYPAL_SANDBOX_CLIENT_SECRET: 'private-client-secret-fixture',
    NEXT_PUBLIC_UNREVIEWED_LEGACY_SETTING: 'existing-runtime-only-fixture',
  };
}
function rejects(operation) {
  assert.throws(operation, (error) => error.message ===
    'Release settings check failed; compiled public settings and runtime payment configuration must match.');
}

test('the public allowlist contains exactly the nine reviewed names', () => {
  assert.equal(PUBLIC_KEYS.length, 9);
  assert.equal(new Set(PUBLIC_KEYS).size, 9);
  assert.ok(PUBLIC_KEYS.every((key) => key.startsWith('NEXT_PUBLIC_')));
});
test('sandbox and live settings match without returning or modifying server credentials', () => {
  for (const mode of ['sandbox', 'live']) {
    const publicSettings = settings(mode);
    const runtime = environment(publicSettings);
    const before = { ...runtime };
    assert.equal(validateRuntimeSettings(publicSettings, runtime), undefined);
    assert.deepEqual(runtime, before);
    assert.deepEqual(validatePublicSettings(publicSettings), publicSettings);
  }
});
test('approved www aliases and one trailing slash are preserved', () => {
  const publicSettings = { ...settings(), NEXT_PUBLIC_SITE_URL: 'https://www.codexchristi.org/',
    NEXT_PUBLIC_SHOP_SITE_URL: 'https://www.codexchristi.shop/',
    NEXT_PUBLIC_DJANGO_API_BASE_URL: 'https://www.codexchristi.org/api/' };
  assert.deepEqual(validatePublicSettings(publicSettings), publicSettings);
});
test('off-site URLs, HTTP, credentials, queries and extra trailing slashes are refused', () => {
  for (const value of ['https://example.invalid', 'http://codexchristi.org',
    'https://user:private-fixture@codexchristi.org', 'https://codexchristi.org/?secret=fixture',
    'https://codexchristi.org//']) {
    rejects(() => validatePublicSettings({ ...settings(), NEXT_PUBLIC_SITE_URL: value }));
  }
});
test('unknown keys, server credentials, interpolation and controls cannot enter the public manifest', () => {
  for (const extra of [{ NEXT_PUBLIC_UNAPPROVED: 'fixture' }, { PAYPAL_SANDBOX_CLIENT_SECRET: 'private-fixture' },
    { NEXT_PUBLIC_CART_KEY: '$EXPANSION' }, { NEXT_PUBLIC_CART_KEY: '`command`' },
    { NEXT_PUBLIC_CART_KEY: 'fixture\nvalue' }, { NEXT_PUBLIC_CART_KEY: 'x'.repeat(4097) }]) {
    rejects(() => validatePublicSettings({ ...settings(), ...extra }));
  }
});
test('required URLs, mode, active client ID and cart key cannot be absent', () => {
  for (const key of Object.keys(settings())) {
    const publicSettings = settings();
    delete publicSettings[key];
    rejects(() => validatePublicSettings(publicSettings));
  }
  for (const value of ['invalid', 'SANDBOX', '']) {
    rejects(() => validatePublicSettings({ ...settings(), NEXT_PUBLIC_PAYPAL_PAYMENT_MODE: value }));
  }
  rejects(() => validatePublicSettings({ ...settings(), NEXT_PUBLIC_PAYPAL_SANDBOX_CLIENT_ID: 'invalid id' }));
});
test('every compiled field must match runtime, including optional values and their presence', () => {
  const compiled = { ...settings(), NEXT_PUBLIC_PAYPAL_LIVE_CLIENT_ID: 'unused-public-id',
    NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_ORG_TOKEN: 'org-token',
    NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_SHOP_TOKEN: 'shop-token' };
  for (const key of PUBLIC_KEYS) {
    const runtime = environment(compiled);
    runtime[key] = 'different-fixture';
    rejects(() => validateRuntimeSettings(compiled, runtime));
    delete runtime[key];
    rejects(() => validateRuntimeSettings(compiled, runtime));
  }
  const runtime = environment(settings());
  runtime.NEXT_PUBLIC_CLOUDFLARE_WEB_ANALYTICS_ORG_TOKEN = '';
  rejects(() => validateRuntimeSettings(settings(), runtime));
});
test('server payment mode and selected client ID must match the compiled browser configuration', () => {
  for (const mode of ['sandbox', 'live']) {
    const compiled = settings(mode);
    for (const changes of [{ PAYPAL_PAYMENT_MODE: mode === 'sandbox' ? 'live' : 'sandbox' },
      { [`PAYPAL_${mode.toUpperCase()}_CLIENT_ID`]: 'different-private-fixture' },
      { [`PAYPAL_${mode.toUpperCase()}_CLIENT_ID`]: undefined }]) {
      rejects(() => validateRuntimeSettings(compiled, { ...environment(compiled), ...changes }));
    }
  }
});

test('the runtime command reads its embedded manifest without application dependencies', () => {
  const folder = realpathSync(mkdtempSync(path.join(tmpdir(), 'release-settings-test-')));
  try {
    mkdirSync(path.join(folder, 'scripts'));
    const script = path.join(folder, 'scripts/check-release-settings.mjs');
    copyFileSync(new URL('../check-release-settings.mjs', import.meta.url), script);
    writeFileSync(path.join(folder, 'release-public-settings.json'), JSON.stringify(settings()));
    const result = spawnSync(process.execPath, [script, '--runtime'], {
      cwd: folder, env: environment(settings()), encoding: 'utf8', timeout: 5000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'Release public settings=OK; runtime payment configuration=matched');
    assert.equal(result.stderr, '');
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test('runtime parser and comparison failures print a fixed message without values or credentials', () => {
  const folder = realpathSync(mkdtempSync(path.join(tmpdir(), 'release-settings-test-')));
  try {
    mkdirSync(path.join(folder, 'scripts'));
    const script = path.join(folder, 'scripts/check-release-settings.mjs');
    copyFileSync(new URL('../check-release-settings.mjs', import.meta.url), script);
    for (const manifest of [JSON.stringify(settings()), 'private-parser-fixture-invalid-json']) {
      writeFileSync(path.join(folder, 'release-public-settings.json'), manifest);
      const result = spawnSync(process.execPath, [script, '--runtime'], {
        cwd: folder, env: { ...environment(settings()), PAYPAL_PAYMENT_MODE: 'private-mismatch-fixture' },
        encoding: 'utf8', timeout: 5000,
      });
      assert.equal(result.status, 1);
      assert.equal(result.stdout, '');
      assert.equal(result.stderr.trim(),
        'Release settings check failed; compiled public settings and runtime payment configuration must match.');
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

/** Request the actual built Next.js route, not the reader in isolation. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

const expectedByMode = {
  sandbox: {
    siteUrl: 'https://codexchristi.org', shopSiteUrl: 'https://codexchristi.shop',
    paymentMode: 'sandbox', paymentClientId: 'synthetic-sandbox-client', cartKey: 'synthetic-sandbox-cart',
    analyticsOrgToken: 'synthetic-sandbox-org', analyticsShopToken: 'synthetic-sandbox-shop',
  },
  live: {
    siteUrl: 'https://www.codexchristi.org', shopSiteUrl: 'https://www.codexchristi.shop',
    paymentMode: 'live', paymentClientId: 'synthetic-live-client', cartKey: 'synthetic-live-cart',
    analyticsOrgToken: null, analyticsShopToken: null,
  },
};
const mode = process.argv[2];
const expected = expectedByMode[mode];
if (!expected || process.argv.length !== 3) process.exit(2);

const address = 'http://127.0.0.1:39271';
// The server has no network except localhost in the fixture container. Do not
// forward process output: the harness reports only fixed pass/fail diagnostics.
const server = spawn(process.execPath, ['/app/server.js'], {
  cwd: '/app', env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: '39271' }, stdio: 'ignore',
});
server.on('error', () => {});
let stage = 'startup';
try {
  let response;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (server.exitCode !== null || server.signalCode !== null) throw new Error('Server exited.');
    try {
      response = await fetch(`${address}/api/runtime-config`, { signal: AbortSignal.timeout(1000), redirect: 'error' });
      break;
    } catch {
      await delay(250);
    }
  }
  assert.ok(response);
  stage = 'runtime configuration response';
  for (const result of [response, await fetch(`${address}/next-api/runtime-config`, {
    signal: AbortSignal.timeout(3000), redirect: 'error',
  })]) {
    assert.equal(result.status, 200);
    assert.match(result.headers.get('cache-control') ?? '', /(?:^|,\s*)no-store(?:,|$)/i);
    const raw = await result.text();
    assert.ok(!raw.includes('private-') && !raw.includes('DJANGO_API_BASE_URL'));
    assert.deepEqual(JSON.parse(raw), expected);
  }
  console.log('Runtime HTTP configuration=OK; fixture=' + mode);
} catch {
  console.error('Runtime HTTP configuration check failed at ' + stage + '.');
  process.exitCode = 1;
} finally {
  if (server.exitCode === null && server.signalCode === null) {
    server.kill('SIGTERM');
    await Promise.race([once(server, 'exit'), delay(3000)]);
    if (server.exitCode === null && server.signalCode === null) server.kill('SIGKILL');
  }
}

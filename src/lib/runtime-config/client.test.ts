import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPublicRuntimeConfigLoader, type PublicRuntimeConfig } from './client';

const config: PublicRuntimeConfig = {
  siteUrl: 'https://codexchristi.org',
  shopSiteUrl: 'https://codexchristi.shop',
  paymentMode: 'sandbox',
  paymentClientId: 'public-fixture',
  cartKey: 'cart-fixture',
  analyticsOrgToken: 'analytics-fixture',
  analyticsShopToken: null,
};

test('concurrent consumers share one request and cache the validated configuration for the document', async () => {
  let release!: (response: Response) => void;
  const gate = new Promise<Response>((resolve) => (release = resolve));
  let requests = 0;
  const loader = createPublicRuntimeConfigLoader(async (input, options) => {
    requests += 1;
    assert.equal(input, '/next-api/runtime-config');
    assert.equal(options?.cache, 'no-store');
    assert.equal(options?.credentials, 'omit');
    assert.ok(options?.signal instanceof AbortSignal);
    return gate;
  });
  const first = loader.load();
  const second = loader.load();
  assert.equal(first, second);
  assert.deepEqual(loader.getSnapshot(), { status: 'loading', config: null });
  release(Response.json(config));
  const result = await first;
  assert.deepEqual(result, config);
  assert.ok(Object.isFrozen(result));
  assert.equal(await second, result);
  assert.equal(await loader.load(), result);
  assert.equal(requests, 1);
  assert.deepEqual(loader.getSnapshot(), { status: 'ready', config });
  assert.deepEqual(loader.getServerSnapshot(), { status: 'loading', config: null });
});

test('fetch and server failures have a fixed safe diagnostic and can be retried', async () => {
  let requests = 0;
  const loader = createPublicRuntimeConfigLoader(async () => {
    requests += 1;
    if (requests === 1) throw new Error('private-fixture');
    if (requests === 2) return Response.json({ message: 'private-fixture' }, { status: 503 });
    return Response.json(config);
  });
  const statuses: string[] = [];
  const unsubscribe = loader.subscribe(() => statuses.push(loader.getSnapshot().status));
  await assert.rejects(loader.load(), { message: 'Browser configuration is unavailable.' });
  assert.deepEqual(loader.getSnapshot(), { status: 'error', config: null });
  await assert.rejects(loader.load(), { message: 'Browser configuration is unavailable.' });
  assert.deepEqual(await loader.load(), config);
  unsubscribe();
  assert.deepEqual(statuses, ['error', 'loading', 'error', 'loading', 'ready']);
  assert.equal(requests, 3);
});

test('unexpected, missing and malformed configuration fields are not cached', async () => {
  const missingCartKey: Record<string, unknown> = { ...config };
  delete missingCartKey.cartKey;
  for (const response of [
    { ...config, PAYPAL_CLIENT_SECRET: 'private-fixture' },
    missingCartKey,
    { ...config, siteUrl: 'https://codexchristi.org.unapproved.example' },
    { ...config, paymentMode: 'invalid' },
    { ...config, analyticsOrgToken: 1 },
    { ...config, analyticsShopToken: '' },
    { ...config, cartKey: 'invalid\nvalue' },
  ]) {
    const loader = createPublicRuntimeConfigLoader(async () => Response.json(response));
    await assert.rejects(loader.load(), { message: 'Browser configuration is unavailable.' });
    assert.deepEqual(loader.getSnapshot(), { status: 'error', config: null });
  }
  const invalid = createPublicRuntimeConfigLoader(async () => new Response('private-parser-fixture'));
  await assert.rejects(invalid.load(), { message: 'Browser configuration is unavailable.' });
});

test('a stalled request times out, allows retry and cannot overwrite a later success', async () => {
  let release!: (response: Response) => void;
  const gate = new Promise<Response>((resolve) => (release = resolve));
  let signal: AbortSignal | null | undefined;
  let requests = 0;
  const loader = createPublicRuntimeConfigLoader(async (_input, options) => {
    requests += 1;
    if (requests === 1) {
      signal = options?.signal;
      return gate;
    }
    return Response.json(config);
  }, 10);
  await assert.rejects(loader.load(), { message: 'Browser configuration is unavailable.' });
  assert.equal(signal?.aborted, true);
  assert.deepEqual(await loader.load(), config);
  release(Response.json({ ...config, cartKey: 'stale-fixture' }));
  await Promise.resolve();
  assert.deepEqual(loader.getSnapshot(), { status: 'ready', config });
});

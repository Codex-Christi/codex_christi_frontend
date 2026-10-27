import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { merchizeCatalogPrisma as db } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';
import { MerchizeProviderError } from './providerErrors';
import { STRICT_STOREFRONT_PROVIDER_TIMEOUT_MS } from './strictLiveProduct';

test('product display uses bounded, ISR-compatible reads and never mistakes outages for missing products', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'storefront-display-test-'));
  const previous = { ...process.env };
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, {
    MERCHIZE_OFFLINE_CATALOG_DATABASE_URL: `file:${join(dir, 'catalog.db')}`,
    MERCHIZE_BASE_URL: 'https://display.example',
    MERCHIZE_API_KEY: 'fixture',
  });
  t.after(async () => {
    globalThis.fetch = originalFetch;
    await db.$disconnect();
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
    await rm(dir, { recursive: true, force: true });
  });
  new Database(join(dir, 'catalog.db')).close();
  execFileSync(
    process.execPath,
    [
      'node_modules/prisma/build/index.js',
      'db',
      'push',
      '--schema',
      'prisma/shop/merchize/priceCatalog.prisma',
    ],
    { env: process.env, stdio: 'pipe' },
  );
  const { fetchBaseProduct, storefrontSnapshotCacheSeconds } =
    await import('@/app/shop/product/[id]/productDetailsSSR');
  const product = {
    _id: 'product-1',
    title: 'Fixture product',
    retail_price: '29',
    image: 'https://d2dytk4tvgwhb4.cloudfront.net/store/products/product-1/front',
    gallery_uris: ['store/gallery/front'],
  };
  const savedImage = 'https://d2dytk4tvgwhb4.cloudfront.net/store/variant/front/thumb.jpg';
  const saveExpiredSnapshot = () =>
    db.storefrontProductSnapshot.upsert({
      where: { merchizeProductId: product._id },
      create: {
        merchizeProductId: product._id,
        title: product.title,
        image: savedImage,
        retailPrice: 29,
        lastProductFetchAt: new Date(0),
      },
      update: {
        image: savedImage,
        rawProductJson: { ...product, gallery_uris: [] },
        lastProductFetchAt: new Date(0),
      },
    });

  await t.test('a first live gallery and the subsequent snapshot show the same image', async () => {
    let fetchCount = 0;
    globalThis.fetch = async (_input, init) => {
      fetchCount++;
      assert.ok(init?.signal instanceof AbortSignal);
      assert.equal(
        (init as { next?: { revalidate?: number } }).next?.revalidate,
        storefrontSnapshotCacheSeconds(),
      );
      assert.equal(init?.cache, undefined, 'display fetching must not opt out of ISR');
      return Response.json({ data: product });
    };
    const cold = await fetchBaseProduct(product._id);
    assert.equal(cold.image, 'https://d2dytk4tvgwhb4.cloudfront.net/store/gallery/front/thumb.jpg');
    assert.equal((await fetchBaseProduct(product._id)).image, cold.image);
    assert.equal(fetchCount, 1, 'a fresh snapshot needs no supplier request');
    const saved = await db.storefrontProductSnapshot.findUniqueOrThrow({
      where: { merchizeProductId: product._id },
    });
    assert.equal(
      (saved.rawProductJson as { image: string }).image,
      product.image,
      'retain the original supplier payload',
    );
  });

  await t.test('an unusable live preview retains an existing display image', async () => {
    await saveExpiredSnapshot();
    globalThis.fetch = async () => Response.json({ data: { ...product, gallery_uris: [] } });
    assert.equal((await fetchBaseProduct(product._id)).image, savedImage);
  });

  await t.test('404 and 410 reject old snapshots; transient failures may use them', async () => {
    for (const status of [404, 410, 429, 503]) {
      await saveExpiredSnapshot();
      globalThis.fetch = async () => new Response('Supplier diagnostic', { status });
      if (status === 429 || status === 503) {
        assert.equal((await fetchBaseProduct(product._id)).image, savedImage);
      } else {
        await assert.rejects(
          () => fetchBaseProduct(product._id),
          (error) => error instanceof MerchizeProviderError && error.kind === 'not_found',
        );
      }
    }
    await db.storefrontProductSnapshot.deleteMany();
    await assert.rejects(
      () => fetchBaseProduct(product._id),
      (error) => error instanceof MerchizeProviderError && error.kind === 'provider_unavailable',
    );
    globalThis.fetch = async () => Response.json({ data: {} });
    await assert.rejects(() => fetchBaseProduct(product._id), /missing required fields/);
  });

  await t.test('the display deadline rejects or falls back without a real wait', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    t.after(() => t.mock.timers.reset());
    for (const fallback of [false, true]) {
      if (fallback) await saveExpiredSnapshot();
      let started!: () => void;
      const requestStarted = new Promise<void>((resolve) => {
        started = resolve;
      });
      globalThis.fetch = async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
            once: true,
          });
          started();
        });
      const request = fetchBaseProduct(product._id);
      await requestStarted;
      t.mock.timers.tick(STRICT_STOREFRONT_PROVIDER_TIMEOUT_MS);
      if (fallback) assert.equal((await request).image, savedImage);
      else
        await assert.rejects(
          request,
          (error) => error instanceof MerchizeProviderError && /timed out/.test(error.message),
        );
    }
  });
});

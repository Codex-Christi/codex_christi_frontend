import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { merchizeCatalogPrisma as db } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';
import { MerchizeProviderError } from './providerErrors';
import { PUBLISHED_SHOP_PRODUCT_IDS } from '@/lib/utils/shopHomePageProductsData';
import { isStorefrontProductUnpublished } from './publication';

test('publication visibility and request cancellation preserve ISR display fallbacks without weakening checkout', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'storefront-publication-'));
  const previous = { ...process.env };
  const cwd = process.cwd();
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, {
    MERCHIZE_OFFLINE_CATALOG_DATABASE_URL: `file:${join(dir, 'catalog.db')}`,
    MERCHIZE_BASE_URL: 'https://publication.example',
    MERCHIZE_CATALOG_URL: 'https://catalog.example/product/catalog',
    MERCHIZE_API_KEY: 'fixture',
  });
  t.after(async () => {
    globalThis.fetch = originalFetch;
    process.chdir(cwd);
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
  const { fetchBaseProduct } = await import('@/app/shop/product/[id]/productDetailsSSR');
  const { upsertStorefrontProductSnapshot } = await import('./snapshot');
  const { getUnpublishedStorefrontProductIds } = await import('./publicationSnapshot');
  const { searchStorefrontProducts } = await import('./searchCatalog');
  const { getUnpublishedProductMetadata } =
    await import('@/lib/shop/seoManifest/productVisibility');
  const { GET: optionsRoute } = await import('@/app/api/shop/products/[id]/variants/route');
  // Manifest paths are scoped to this fixture process, never the running app's files.
  process.chdir(dir);
  const { generateShopSeoManifest, hasChangedShopSearchPreviews } =
    await import('@/lib/shop/seoManifest/generate');
  const { readProductSeoManifestEntry } = await import('@/lib/shop/seoManifest/read');
  const product = {
    _id: PUBLISHED_SHOP_PRODUCT_IDS[0],
    slug: 'fixture-product',
    title: 'Publication fixture',
    description: 'Fixture details',
    retail_price: '30',
    image: '',
    gallery_uris: ['store/gallery/front'],
    is_active: true,
    is_private: false,
    is_deleted: false,
    is_taken_down: false,
    approval_status: 'approved',
  };
  const isNotFound = (error: unknown) =>
    error instanceof MerchizeProviderError && error.kind === 'not_found';
  const saved = () =>
    db.storefrontProductSnapshot.findUniqueOrThrow({ where: { merchizeProductId: product._id } });
  await upsertStorefrontProductSnapshot(product, { force: true });

  await t.test(
    'a fresh published snapshot stays fast, while a forced private observation overrides its TTL',
    async () => {
      globalThis.fetch = async () => assert.fail('Fresh snapshots must not fetch');
      assert.equal((await fetchBaseProduct(product._id)).title, product.title);
      await generateShopSeoManifest();
      assert.equal((await readProductSeoManifestEntry(product._id))?.title, product.title);
      globalThis.fetch = async () =>
        Response.json({ data: { ...product, title: 'Private title', is_private: true } });
      await assert.rejects(() => fetchBaseProduct(product._id, true), isNotFound);
      assert.equal(
        (await saved()).title,
        'Private title',
        'Do not overwrite the new private payload with an old display copy',
      );
      globalThis.fetch = async () =>
        assert.fail('Known private snapshots must not fetch before expiry');
      await assert.rejects(() => fetchBaseProduct(product._id), isNotFound);
      await assert.rejects(() => fetchBaseProduct(product.slug), isNotFound);
      assert.ok((await getUnpublishedStorefrontProductIds([product._id])).has(product._id));
      globalThis.fetch = async () =>
        Response.json({
          data: { products: [product], page: 1, pages: 1, total: 1 },
        });
      assert.deepEqual(
        (await searchStorefrontProducts('Publication fixture')).products,
        [],
        'Cached supplier search results must not override a confirmed private snapshot',
      );
    },
  );

  await t.test(
    'old manifest content and local homepage fallbacks cannot revive a private product',
    async () => {
      const metadata = await getUnpublishedProductMetadata(product._id);
      assert.deepEqual(metadata?.robots, { index: false, follow: false });
      assert.doesNotMatch(JSON.stringify(metadata), /Private title|Publication fixture|30|gallery/);
      assert.ok(await getUnpublishedProductMetadata(product.slug));
      assert.equal(await hasChangedShopSearchPreviews(), true);
      const result = await generateShopSeoManifest();
      assert.equal(await readProductSeoManifestEntry(product._id), null);
      assert.ok(result.affectedRoutes.includes(`/shop/product/${product._id}`));
      assert.equal(await hasChangedShopSearchPreviews(), false);
    },
  );

  await t.test(
    'unknown fields do not clear confirmed negative state; fresh live publication can restore it',
    async () => {
      await upsertStorefrontProductSnapshot(
        { _id: product._id, title: 'Legacy', retail_price: '30' },
        { force: true },
      );
      assert.equal(isStorefrontProductUnpublished((await saved()).rawProductJson), true);
      await upsertStorefrontProductSnapshot(product, { refreshPublication: true });
      assert.equal(await getUnpublishedProductMetadata(product._id), null);
      assert.equal((await fetchBaseProduct(product._id)).title, product.title);
      await upsertStorefrontProductSnapshot(
        { ...product, is_active: false },
        { refreshPublication: true },
      );
      assert.equal(
        isStorefrontProductUnpublished((await saved()).rawProductJson),
        true,
        'Negative evidence must bypass a fresh display TTL',
      );
      await upsertStorefrontProductSnapshot(product, {
        refreshPublication: true,
        observedAt: new Date(0),
      });
      assert.equal(
        isStorefrontProductUnpublished((await saved()).rawProductJson),
        true,
        'A late old verification cannot reverse newer publication evidence',
      );
      await upsertStorefrontProductSnapshot(product);
      assert.equal(
        isStorefrontProductUnpublished((await saved()).rawProductJson),
        true,
        'A cached listing cannot immediately clear newer negative evidence',
      );
      await upsertStorefrontProductSnapshot(product, { refreshPublication: true });
      await upsertStorefrontProductSnapshot({ ...product, is_private: true });
      assert.equal(
        isStorefrontProductUnpublished((await saved()).rawProductJson),
        false,
        'An old cached listing must not undo a newer verified publication',
      );
      const newer = new Date();
      await Promise.all([
        upsertStorefrontProductSnapshot(
          { ...product, is_private: true },
          { refreshPublication: true, observedAt: newer },
        ),
        upsertStorefrontProductSnapshot(product, {
          force: true,
          observedAt: new Date(newer.getTime() - 1_000),
        }),
      ]);
      assert.equal(
        isStorefrontProductUnpublished((await saved()).rawProductJson),
        true,
        'Concurrent older positive observations cannot overwrite a newer removal',
      );
      await upsertStorefrontProductSnapshot(product, { refreshPublication: true });
    },
  );

  await t.test(
    'a confirmed 410 is retained across a later outage, but a transient outage never marks an active product removed',
    async () => {
      await db.storefrontProductSnapshot.update({
        where: { merchizeProductId: product._id },
        data: { lastProductFetchAt: new Date(0) },
      });
      globalThis.fetch = async () => new Response('', { status: 503 });
      assert.equal((await fetchBaseProduct(product._id)).title, product.title);
      assert.equal(isStorefrontProductUnpublished((await saved()).rawProductJson), false);
      globalThis.fetch = async () => new Response('', { status: 410 });
      await assert.rejects(() => fetchBaseProduct(product._id), isNotFound);
      assert.equal(isStorefrontProductUnpublished((await saved()).rawProductJson), true);
      await db.storefrontProductSnapshot.update({
        where: { merchizeProductId: product._id },
        data: { lastProductFetchAt: new Date(0) },
      });
      globalThis.fetch = async () => new Response('', { status: 503 });
      await assert.rejects(() => fetchBaseProduct(product._id), isNotFound);
      await upsertStorefrontProductSnapshot(product, { force: true });
    },
  );

  await t.test(
    'canceling during catalog verification aborts its shared provider read and saves no negative evidence',
    async () => {
      const controller = new AbortController();
      let started!: () => void;
      const catalogStarted = new Promise<void>((resolve) => {
        started = resolve;
      });
      let catalogSignal!: AbortSignal;
      const supplier = {
        _id: 'supplier-product',
        sku: '6014US',
        variants: [
          {
            _id: 'supplier-variant',
            sku: '6014US000BERAA01',
            options: [{ attribute_type: 'size', value: 'M' }],
            shipping_prices: [],
          },
        ],
      };
      globalThis.fetch = async (input, init) => {
        const url = String(input);
        if (url.includes('catalog.example'))
          return new Promise<Response>((_resolve, reject) => {
            assert.ok(init?.signal);
            catalogSignal = init.signal;
            init.signal.addEventListener('abort', () => reject(init.signal?.reason), {
              once: true,
            });
            started();
          });
        if (init?.method === 'POST')
          return Response.json({ data: { presets: [{ ...supplier, title: 'Fixture Shirt' }] } });
        if (url.endsWith('/all-variants'))
          return Response.json({
            success: true,
            data: [
              {
                _id: 'variant-1',
                product: product._id,
                sku: 'SELLER-SKU',
                title: 'Medium',
                retail_price: 30,
                options: [
                  {
                    name: '6014US',
                    value: '6014US',
                    attribute: { name: 'Product', value_type: 'product' },
                  },
                  { name: 'M', value: 'M', attribute: { name: 'Size', value_type: 'size' } },
                ],
              },
            ],
          });
        return Response.json({ data: product });
      };
      const result = optionsRoute(
        new Request('http://localhost/api?country=USA', { signal: controller.signal }),
        { params: Promise.resolve({ id: product._id }) },
      );
      await catalogStarted;
      controller.abort();
      assert.equal((await result).status, 499);
      assert.equal(catalogSignal.aborted, true);
      assert.equal(await db.supplierCatalogProductEvidence.count(), 0);
      assert.equal(await db.storefrontProductCheck.count(), 0);
      assert.equal(await db.storefrontProductDestinationCheck.count(), 0);
    },
  );

  await t.test(
    'pre-aborted and in-flight option requests cancel both provider reads without recording failures',
    async () => {
      for (const preAborted of [true, false]) {
        const controller = new AbortController();
        if (preAborted) controller.abort();
        const signals: AbortSignal[] = [];
        let started!: () => void;
        const requestsStarted = new Promise<void>((resolve) => {
          started = resolve;
        });
        globalThis.fetch = async (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            assert.ok(init?.signal);
            signals.push(init.signal);
            init.signal.addEventListener('abort', () => reject(init.signal?.reason), {
              once: true,
            });
            if (signals.length === 2) started();
          });
        const request = optionsRoute(
          new Request('http://localhost/api?country=USA', { signal: controller.signal }),
          { params: Promise.resolve({ id: product._id }) },
        );
        if (!preAborted) {
          await requestsStarted;
          controller.abort();
        }
        assert.equal((await request).status, 499);
        assert.equal(signals.length, preAborted ? 0 : 2);
        assert.ok(signals.every((signal) => signal.aborted));
        assert.equal(await db.storefrontProductCheck.count(), 0);
        assert.equal(await db.storefrontProductDestinationCheck.count(), 0);
      }
      globalThis.fetch = async () => new Response('', { status: 503 });
      const response = await optionsRoute(new Request('http://localhost/api?country=USA'), {
        params: Promise.resolve({ id: product._id }),
      });
      assert.equal(response.status, 503);
      assert.equal(
        (await db.storefrontProductDestinationCheck.findFirstOrThrow()).completed,
        false,
        'Real outages must still be reported as unverified',
      );
    },
  );
});

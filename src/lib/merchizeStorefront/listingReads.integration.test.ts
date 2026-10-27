import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { merchizeCatalogPrisma as db } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';
import { MerchizeProviderError } from './providerErrors';
import {
  InvalidStorefrontListingPayloadError,
  STOREFRONT_LISTING_TIMEOUT_MS,
} from './listingPayload';

test('category and search reads use bounded provider calls and isolated display snapshots', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'storefront-listings-'));
  const previous = { ...process.env };
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, {
    MERCHIZE_OFFLINE_CATALOG_DATABASE_URL: `file:${join(dir, 'catalog.db')}`,
    MERCHIZE_BASE_URL: 'https://listing.example',
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
  const { fetchCategoryProducts, getCategoryMetadataFromMerchize } =
    await import('@/app/shop/category/[id]/categoryDetailsSSR');
  const { getProductSearchIndex, searchStorefrontProducts } = await import('./searchCatalog');
  const { GET: searchIndexResponse } = await import('@/app/api/shop/search-index/route');
  const { upsertStorefrontCategoryPageSnapshot, upsertStorefrontCategorySnapshot } =
    await import('./snapshot');
  const product = {
    _id: 'product-1',
    title: 'Classic White Logo Hoodie',
    retail_price: '30',
    image: '',
    gallery_uris: ['store/gallery/front'],
    is_active: true,
    is_deleted: false,
    is_private: false,
    is_taken_down: false,
    approval_status: 'approved',
  };
  const listing = (products = [product], page = 1, pages = 1, total = products.length) => ({
    success: true,
    data: { products, page, pages, total },
  });
  const categoryParams = { category: 'hoodies', page: 1, page_size: 15 };
  const expire = async () => {
    await db.storefrontCategorySnapshot.updateMany({
      data: { lastMetadataFetchAt: new Date(0), lastProductsFetchAt: new Date(0) },
    });
    await db.storefrontCategoryProduct.updateMany({ data: { lastSeenAt: new Date(0) } });
  };

  await t.test(
    'fresh category pages need no supplier request; an unsaved page is fetched',
    async () => {
      await upsertStorefrontCategorySnapshot({
        categorySlug: 'hoodies',
        merchizeCategoryId: 'category-1',
        name: 'Hoodies',
      });
      await upsertStorefrontCategoryPageSnapshot({
        categorySlug: 'hoodies',
        merchizeCategoryId: 'category-1',
        page: 1,
        pageSize: 15,
        total: 16,
        totalPages: 2,
        products: Array.from({ length: 15 }, (_, index) => ({
          ...product,
          _id: `product-${index + 1}`,
        })),
      });
      globalThis.fetch = async () => {
        throw new Error('Fresh snapshots must not fetch');
      };
      assert.equal((await getCategoryMetadataFromMerchize('hoodies')).name, 'Hoodies');
      assert.equal((await fetchCategoryProducts(categoryParams)).products.length, 15);
      let count = 0;
      globalThis.fetch = async (_url, init) => {
        count++;
        assert.ok(init?.signal instanceof AbortSignal);
        assert.equal((init as { next?: { revalidate: number } }).next?.revalidate, 25920);
        assert.equal(init?.cache, undefined);
        return Response.json(listing([{ ...product, _id: 'product-16' }], 2, 2, 16));
      };
      assert.equal(
        (await fetchCategoryProducts({ ...categoryParams, page: 2 })).products[0]._id,
        'product-16',
      );
      assert.equal(count, 1);
      globalThis.fetch = async () => new Response('', { status: 503 });
      assert.equal(
        (await fetchCategoryProducts({ ...categoryParams, page: 2 })).products[0]._id,
        'product-16',
      );
      await assert.rejects(
        () => fetchCategoryProducts({ ...categoryParams, page: 3 }),
        MerchizeProviderError,
        'An unsaved page must not masquerade as an empty fresh page or another page',
      );
    },
  );

  await t.test(
    'pages are stored independently, expired rows stay expired, and removed page members are pruned',
    async () => {
      const { getCategoryProductsSnapshotState } = await import('./snapshot');
      const params = { category: 'jackets', page: 2, page_size: 15 };
      const savePage = (products: (typeof product)[], page = 2, total = 16) =>
        upsertStorefrontCategoryPageSnapshot({
          categorySlug: 'jackets',
          page,
          pageSize: 15,
          total,
          totalPages: Math.ceil(total / 15),
          products,
          force: true,
        });
      await savePage([{ ...product, _id: 'product-16' }]);
      assert.equal(
        (await getCategoryProductsSnapshotState(params))?.products.products[0]._id,
        'product-16',
      );
      assert.equal(await getCategoryProductsSnapshotState({ ...params, page: 1 }), null);
      await savePage([product]);
      assert.deepEqual(
        (await getCategoryProductsSnapshotState(params))?.products.products.map((item) => item._id),
        ['product-1'],
      );
      await savePage([], 1, 0);
      assert.deepEqual(
        (await getCategoryProductsSnapshotState({ ...params, page: 1 }))?.products.products,
        [],
      );
      assert.equal(
        await db.storefrontCategoryProduct.count({
          where: { category: { categorySlug: 'jackets' } },
        }),
        0,
      );
      await expire();
      await upsertStorefrontCategoryPageSnapshot({
        categorySlug: 'hoodies',
        page: 2,
        pageSize: 15,
        total: 16,
        totalPages: 2,
        products: [{ ...product, _id: 'product-16' }],
      });
      assert.equal(
        (await getCategoryProductsSnapshotState(categoryParams))?.isFresh,
        false,
        'Updating page 2 cannot renew page 1',
      );
    },
  );

  await t.test(
    'transient and malformed responses use complete saved pages, never confirmed 404/410',
    async () => {
      await expire();
      for (const status of [429, 503, 404, 410]) {
        globalThis.fetch = async () => new Response('', { status });
        if (status === 429 || status === 503) {
          assert.equal((await fetchCategoryProducts(categoryParams)).products.length, 15);
          assert.equal((await getCategoryMetadataFromMerchize('hoodies')).name, 'Hoodies');
        } else {
          await assert.rejects(
            () => fetchCategoryProducts(categoryParams),
            (error) => error instanceof MerchizeProviderError && error.kind === 'not_found',
          );
          await assert.rejects(
            () => getCategoryMetadataFromMerchize('hoodies'),
            (error) => error instanceof MerchizeProviderError && error.kind === 'not_found',
          );
        }
      }
      globalThis.fetch = async () => Response.json({ success: true, data: {} });
      assert.equal((await fetchCategoryProducts(categoryParams)).products.length, 15);
      assert.equal((await getCategoryMetadataFromMerchize('hoodies')).name, 'Hoodies');
      await assert.rejects(
        () => getCategoryMetadataFromMerchize('hoodies', true),
        InvalidStorefrontListingPayloadError,
      );
      await assert.rejects(
        () => fetchCategoryProducts({ ...categoryParams, forceSnapshotRefresh: true }),
        InvalidStorefrontListingPayloadError,
      );
      globalThis.fetch = async () => new Response('not-json');
      assert.equal((await fetchCategoryProducts(categoryParams)).products.length, 15);
      await assert.rejects(
        () => fetchCategoryProducts({ ...categoryParams, page_size: 101 }),
        RangeError,
      );
    },
  );

  await t.test(
    'empty collection searches are confirmed missing, not malformed or server errors',
    async () => {
      globalThis.fetch = async () => Response.json({ success: true, data: { collections: [] } });
      await assert.rejects(
        () => getCategoryMetadataFromMerchize('missing'),
        (error) => error instanceof MerchizeProviderError && error.kind === 'not_found',
      );
      globalThis.fetch = async () => Response.json({ success: true, data: { collections: [{}] } });
      await assert.rejects(
        () => getCategoryMetadataFromMerchize('missing'),
        InvalidStorefrontListingPayloadError,
      );
    },
  );

  await t.test(
    'every category network hop aborts at its deadline and force refresh still fails',
    async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout'] });
      t.after(() => t.mock.timers.reset());
      await db.storefrontCategoryProduct.updateMany({ data: { lastSeenAt: new Date(0) } });
      for (const [read, hasFallback] of [
        [() => fetchCategoryProducts(categoryParams), true],
        [() => getCategoryMetadataFromMerchize('hoodies'), true],
        [() => getCategoryMetadataFromMerchize('missing'), false],
        [() => searchStorefrontProducts('Hoodie'), true],
        [() => fetchCategoryProducts({ ...categoryParams, forceSnapshotRefresh: true }), false],
      ] as const) {
        let started!: () => void;
        const requestStarted = new Promise<void>((resolve) => {
          started = resolve;
        });
        globalThis.fetch = async (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
              once: true,
            });
            started();
          });
        const request = read();
        await requestStarted;
        t.mock.timers.tick(STOREFRONT_LISTING_TIMEOUT_MS);
        if (hasFallback) await assert.doesNotReject(request);
        else
          await assert.rejects(
            request,
            (error) => error instanceof MerchizeProviderError && /timed out/.test(error.message),
          );
      }
    },
  );

  await t.test(
    'the public index returns only display fields and excludes private or confirmed removed products',
    async () => {
      await db.storefrontProductSnapshot.update({
        where: { merchizeProductId: 'product-2' },
        data: { rawProductJson: { ...product, is_private: true } },
      });
      await db.storefrontProductCheck.create({
        data: {
          merchizeProductId: 'product-3',
          title: product.title,
          checkedAt: new Date(Date.now() + 1000),
          productAvailable: false,
          availableCount: 0,
          unavailableCount: 1,
          unverifiedCount: 0,
        },
      });
      const index = await getProductSearchIndex();
      assert.equal(index.products.length, 14);
      assert.ok(!index.products.some((row) => row.id === 'product-2' || row.id === 'product-3'));
      assert.deepEqual(Object.keys(index.products[0]).sort(), ['id', 'image', 'price', 'title']);
      const response = await searchIndexResponse();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Cache-Control'), 'public, max-age=60');
      assert.ok(!JSON.stringify(await response.json()).includes('rawProductJson'));
    },
  );

  await t.test(
    'submitted search encodes the title, limits the page, preserves caching, and hides private results',
    async () => {
      globalThis.fetch = async (url, init) => {
        const parsed = new URL(String(url));
        assert.equal(parsed.searchParams.get('title'), 'Classic & White');
        assert.equal(parsed.searchParams.get('limit'), '15');
        assert.equal(parsed.searchParams.get('page'), '2');
        assert.equal((init as { next?: { revalidate: number } }).next?.revalidate, 300);
        assert.ok(init?.signal instanceof AbortSignal);
        return Response.json(
          listing([product, { ...product, _id: 'private', is_private: true }], 2, 2, 17),
        );
      };
      const result = await searchStorefrontProducts('Classic & White', 2);
      assert.equal(result.source, 'supplier');
      assert.equal(result.products.length, 1);
      assert.equal(result.products[0].id, product._id);
      assert.equal(result.totalPages, 2);
      assert.equal(
        await db.storefrontProductDestinationCheck.count(),
        0,
        'Search must not create purchase verification evidence',
      );
      assert.equal(
        await db.storefrontProductCheck.count(),
        1,
        'Search must leave existing verification evidence alone',
      );
      await assert.rejects(() => searchStorefrontProducts('Hoodie', 1001), RangeError);
    },
  );

  await t.test(
    'outages show labeled saved results; empty supplier matches can show local typo suggestions',
    async () => {
      globalThis.fetch = async () => new Response('', { status: 503 });
      const fallback = await searchStorefrontProducts('hodie');
      assert.equal(fallback.source, 'saved');
      assert.equal(fallback.products.length, 14);
      globalThis.fetch = async () => Response.json(listing([]));
      assert.equal((await searchStorefrontProducts('hodie')).source, 'similar');
      assert.equal((await searchStorefrontProducts('unicorn')).products.length, 0);
      await db.storefrontProductSnapshot.deleteMany();
      globalThis.fetch = async () => new Response('', { status: 503 });
      assert.equal((await searchStorefrontProducts('hoodie')).source, 'unavailable');
      assert.equal(
        (await searchIndexResponse()).status,
        503,
        'Missing local data is not a successful empty catalog',
      );
    },
  );
});

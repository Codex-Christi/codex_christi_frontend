import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { merchizeCatalogPrisma as db } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';
import { createStorefrontVerificationContext } from '@/lib/merchizeStorefront/currentProductLineCompatibility';
import { resolveCanonicalOrderSnapshotFromMerchize } from '@/lib/paypal/orderSnapshot/merchizeResolver';

test('scoped SQLite evidence renews on demand while checkout rechecks live price and publication', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'merchize-product-evidence-test-'));
  const previous = { ...process.env };
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, {
    MERCHIZE_OFFLINE_CATALOG_DATABASE_URL: `file:${join(dir, 'catalog.db')}`,
    MERCHIZE_BASE_URL: 'https://storefront.example',
    MERCHIZE_CATALOG_URL: 'https://catalog.example/product/catalog',
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
  const supplier = {
    _id: 'supplier-product',
    sku: '6014US',
    variants: [
      {
        _id: 'supplier-variant',
        sku: '6014US000BERAA01',
        shipping_prices: [{ to_zone: 'US', to_country: 'all', first_item: 7, additional_item: 2 }],
      },
    ],
  };
  let price = 29;
  let active = true;
  let includeUnselected = true;
  let catalogVariants = supplier.variants;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    let body: unknown;
    if (url.includes('catalog.example')) {
      assert.equal(new URL(url).searchParams.get('search'), '6014US');
      body = {
        success: true,
        data: {
          page: 1,
          limit: 50,
          total: 1,
          products: [{ ...supplier, variants: catalogVariants }],
        },
      };
    } else if (init?.method === 'POST') {
      assert.equal(JSON.parse(String(init.body)).title, '6014US');
      body = {
        data: {
          presets: [
            {
              ...supplier,
              title: 'Fixture Shirt',
              variants: supplier.variants.map((v) => ({
                ...v,
                options: [{ attribute_type: 'size', value: 'M' }],
              })),
            },
          ],
        },
      };
    } else if (url.endsWith('/all-variants')) {
      const variant = {
        _id: 'variant-1',
        product: 'product-1',
        sku: 'SELLER-SKU',
        title: 'Medium',
        retail_price: price,
        image_uris: ['https://images.example/shirt.jpg'],
        is_default: true,
        options: [
          {
            name: '6014US',
            value: '6014US',
            attribute: { name: 'Product', value_type: 'product' },
          },
          { name: 'M', value: 'M', attribute: { name: 'Size', value_type: 'size' } },
        ],
      };
      body = {
        success: true,
        data: [
          variant,
          {
            ...variant,
            _id: 'unselected',
            options: [
              {
                name: 'Unrelated Line',
                value: 'Unrelated Line',
                attribute: { name: 'Product', value_type: 'product' },
              },
            ],
          },
        ],
      };
      if (!includeUnselected) body = { success: true, data: [variant] };
    } else if (url.endsWith('/product/products/product-1')) {
      body = {
        data: {
          _id: 'product-1',
          slug: 'fixture-shirt',
          title: 'Fixture Shirt',
          retail_price: '1',
          is_active: active,
          is_deleted: false,
          is_private: false,
          is_taken_down: false,
          approval_status: 'approved',
        },
      };
    } else throw Error(`Unexpected request: ${url}`);
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  const fixtureFetch = globalThis.fetch;
  const input = {
    selections: [{ productId: 'product-1', variantId: 'variant-1', quantity: 2 }],
    destination: { countryIso3: 'USA' },
  };
  const resolve = () => resolveCanonicalOrderSnapshotFromMerchize(input);
  const first = await resolve();
  assert.equal(first.subtotal.value, '58.00');
  assert.equal(await db.syncState.count(), 0, 'a complete global generation is not required');
  assert.equal(await db.supplierCatalogProductEvidence.count(), 1);
  assert.equal(await db.supplierCatalogVariantEvidence.count(), 1);
  assert.equal(calls.length, 4, 'base, all-variants, preset, and scoped catalog only');
  assert.ok(calls.every((call) => call.init?.cache === 'no-store'));
  assert.ok(calls.every((call) => call.init?.signal instanceof AbortSignal));
  calls.length = 0;
  price = 31;
  const second = await resolve();
  assert.equal(
    second.subtotal.value,
    '62.00',
    'warm supplier proof must never cache retail prices',
  );
  assert.equal(calls.length, 3, 'warm proof is shared by identity and shipping');
  assert.ok(!calls.some((call) => call.url.includes('/variants/search')));

  calls.length = 0;
  await resolveCanonicalOrderSnapshotFromMerchize(
    input,
    createStorefrontVerificationContext({ forceRefresh: true }),
  );
  assert.equal(calls.length, 4, 'manual checks renew a fresh proof');
  active = false;
  await assert.rejects(resolve, /no longer available/);
  active = true;
  await db.supplierCatalogProductEvidence.updateMany({ data: { verifiedAt: new Date(0) } });
  catalogVariants = [];
  await assert.rejects(
    resolve,
    (error: unknown) =>
      error instanceof Error && 'code' in error && error.code === 'VARIANT_UNAVAILABLE',
  );
  assert.equal(
    await db.supplierCatalogVariantEvidence.count(),
    0,
    'removed SKU links are replaced atomically',
  );
  catalogVariants = supplier.variants;
  await db.supplierCatalogProductEvidence.updateMany({ data: { verifiedAt: new Date(0) } });
  calls.length = 0;
  await Promise.all([resolve(), resolve()]);
  assert.equal(
    calls.filter((call) => call.url.includes('catalog.example')).length,
    1,
    'concurrent requests share the supplier renewal',
  );
  const { fetchBaseProduct } = await import('@/app/shop/product/[id]/productDetailsSSR');
  await fetchBaseProduct('product-1', true);
  globalThis.fetch = async () => new Response('Unavailable', { status: 503 });
  await assert.rejects(() => fetchBaseProduct('product-1', true));
  assert.equal(
    (await fetchBaseProduct('product-1'))._id,
    'product-1',
    'normal ISR/display reads retain their saved fallback',
  );
  globalThis.fetch = fixtureFetch;
  includeUnselected = false;
  const { GET } = await import('@/app/api/shop/products/[id]/variants/route');
  const requestOptions = (country: string) =>
    GET(
      new Request(`http://localhost/next-api/shop/products/product-1/variants?country=${country}`),
      { params: Promise.resolve({ id: 'product-1' }) },
    );
  const domestic = await requestOptions('USA');
  assert.equal(domestic.status, 200);
  assert.equal((await domestic.json()).data.length, 1);
  const international = await requestOptions('NGA');
  assert.equal(international.status, 200);
  const internationalBody = await international.json();
  assert.deepEqual(internationalBody.data, []);
  assert.equal(internationalBody.unavailabilityReason, 'shipping_unavailable');
  assert.equal(international.headers.get('Cache-Control'), 'private, no-store');
  const callsBeforeInvalidCountry = calls.length;
  assert.equal((await requestOptions('INVALID')).status, 400);
  assert.equal(calls.length, callsBeforeInvalidCountry);
  await db.storefrontCategorySnapshot.create({
    data: {
      categorySlug: 't-shirts',
      name: 'T-shirts',
      products: { create: { product: { connect: { merchizeProductId: 'product-1' } } } },
    },
  });
  const { getStorefrontProductDirectory } =
    await import('@/app/admin/(dashboard)/shop/storefront-data-health/products/productDirectoryData');
  globalThis.fetch = async () => {
    throw Error('The admin directory must not fetch the supplier catalog');
  };
  const directory = await getStorefrontProductDirectory({
    q: 'Fixture',
    country: 'USA',
    page: '999',
  });
  assert.equal(directory.rows.length, 1);
  assert.equal(directory.rows[0].productId, 'product-1');
  assert.equal(
    directory.filters.page,
    999,
    'pagination is applied once in the client, after streamed updates',
  );
  assert.equal(
    (await getStorefrontProductDirectory({ country: 'USA', attention: '1' })).rows.filter(
      (row) => row.needsReview,
    ).length,
    0,
  );
  const unsupported = await getStorefrontProductDirectory({ country: 'NGA', attention: '1' });
  assert.equal(unsupported.rows.filter((row) => row.needsReview).length, 1);
  assert.match(unsupported.rows[0].status, /No delivery options for Nigeria/);
  assert.equal(unsupported.rows[0].source, 'catalog');
  const destinationCount = await db.storefrontProductDestinationCheck.count();
  const newDestination = await getStorefrontProductDirectory({ country: 'CAN', attention: '1' });
  assert.equal(
    newDestination.rows.filter((row) => row.needsReview).length,
    1,
    'the review filter includes locally calculated delivery restrictions',
  );
  assert.match(newDestination.rows[0].status, /No delivery options for Canada/);
  assert.equal(
    await db.storefrontProductDestinationCheck.count(),
    destinationCount,
    'selecting a new country derives from SQLite without remote calls or extra summary writes',
  );
  assert.equal((await getStorefrontProductDirectory({}, 'Nigeria')).filters.country, 'NGA');
  const sourceCheck = await db.storefrontProductCheck.findUniqueOrThrow({
    where: { merchizeProductId: 'product-1' },
  });
  await db.storefrontProductCheck.update({
    where: { merchizeProductId: 'product-1' },
    data: { checkedAt: new Date(0) },
  });
  const expiredDirectory = await getStorefrontProductDirectory({ country: 'USA' });
  assert.match(expiredDirectory.rows[0].status, /out of date/);
  await db.storefrontProductCheck.update({
    where: { merchizeProductId: 'product-1' },
    data: { checkedAt: sourceCheck.checkedAt },
  });
  const savedEvidence = await db.supplierCatalogProductEvidence.findFirstOrThrow();
  await db.supplierCatalogProductEvidence.update({
    where: { id: savedEvidence.id },
    data: { verifiedAt: new Date(0) },
  });
  assert.match(
    (await getStorefrontProductDirectory({ country: 'USA' })).rows[0].status,
    /out of date/,
  );
  await db.supplierCatalogProductEvidence.update({
    where: { id: savedEvidence.id },
    data: { verifiedAt: savedEvidence.verifiedAt },
  });
  const originalOptions = sourceCheck.supplierOptionsJson as {
    storeScope: string;
    options: Array<Record<string, string>>;
  };
  await db.storefrontProductCheck.update({
    where: { merchizeProductId: 'product-1' },
    data: {
      supplierOptionsJson: {
        ...originalOptions,
        options: originalOptions.options.map((option) => ({
          ...option,
          supplierVariantId: 'wrong-identity',
        })),
      },
    },
  });
  assert.match(
    (await getStorefrontProductDirectory({ country: 'USA' })).rows[0].status,
    /could not be confirmed/,
  );
  await db.storefrontProductCheck.update({
    where: { merchizeProductId: 'product-1' },
    data: { supplierOptionsJson: originalOptions },
  });
  assert.equal((await getStorefrontProductDirectory({ q: 'No match' })).rows.length, 0);
  globalThis.fetch = async () => new Response('Supplier internal diagnostic', { status: 503 });
  const outage = await requestOptions('USA');
  assert.equal(outage.status, 503);
  assert.doesNotMatch(JSON.stringify(await outage.json()), /Supplier internal diagnostic/);
  const failedCheck = await db.storefrontProductDestinationCheck.findUnique({
    where: {
      merchizeProductId_countryIso3: { merchizeProductId: 'product-1', countryIso3: 'USA' },
    },
  });
  assert.equal(failedCheck?.completed, false);
  assert.equal(failedCheck?.reason, 'verification_unavailable');
  assert.match(
    (await getStorefrontProductDirectory({ country: 'USA' })).rows[0].status,
    /could not be confirmed/,
    'an earlier catalog preview cannot conceal a newer failed live check',
  );

  const { checkDeliveryProducts } =
    await import('@/app/admin/(dashboard)/shop/storefront-data-health/products/deliveryChecks');
  const batchIds = Array.from({ length: 6 }, (_, i) => `product-batch-${i}`);
  calls.length = 0;
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    const id = batchIds.find((id) => url.includes(`/product/products/${id}`));
    const response = await fixtureFetch(id ? url.replace(id, 'product-1') : input, init);
    if (!id) return response;
    const body = await response.json();
    if (Array.isArray(body.data))
      body.data = body.data.map((variant: Record<string, unknown>) => ({
        ...variant,
        _id: `${id}-variant`,
        product: id,
      }));
    else body.data = { ...body.data, _id: id, slug: id };
    return Response.json(body);
  }) as typeof fetch;
  const results: string[] = [];
  const batch = await checkDeliveryProducts({
    productIds: batchIds,
    country: 'USA',
    force: false,
    signal: new AbortController().signal,
    emit(event) {
      if (event.type === 'result') results.push(event.productId);
    },
  });
  assert.deepEqual(batch, { completed: 6, failed: 0 });
  assert.equal(results.length, 6);
  assert.equal(
    calls.filter((call) => call.init?.method === 'POST').length,
    1,
    'all products in a batch share one product-line preset request',
  );
  const countBeforeCancellation = await db.storefrontProductDestinationCheck.count();
  const controller = new AbortController();
  globalThis.fetch = (async (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('Fixture cancellation')), {
        once: true,
      });
      setImmediate(() => controller.abort());
    })) as typeof fetch;
  const cancelled = await checkDeliveryProducts({
    productIds: batchIds,
    country: 'CAN',
    force: false,
    signal: controller.signal,
    emit(event) {
      assert.notEqual(event.type, 'result', 'cancelled requests cannot publish late results');
    },
  });
  assert.equal(cancelled.completed, 0);
  assert.equal(
    await db.storefrontProductDestinationCheck.count(),
    countBeforeCancellation,
    'cancelling a dashboard request must not persist provider-unavailable failures',
  );
});

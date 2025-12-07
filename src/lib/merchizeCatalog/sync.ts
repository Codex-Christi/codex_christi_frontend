// src/lib/merchizeCatalog/sync.ts
import { merchizeCatalogPrisma } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';
// 🔧 adjust this import path if your generated client lives elsewhere
import type { Prisma } from '../prisma/shop/merchize/generated/merchizeCatalog/client';

const CATALOG_URL = process.env.MERCHIZE_CATALOG_URL!;
const API_KEY = process.env.MERCHIZE_API_KEY!;

// --- API types ---------------------------------------------------------

export interface MerchizeTier {
  name: string; // usually "tier1" | "tier2" | "tier3"
  price: number | null;
}

export interface MerchizeShippingPrice {
  to_zone: string; // "US" | "EU" | "GB" | "CA" | "ROW" | ...
  to_country?: string; // "all" or specific country code, if present

  // Old field names (earlier API shape)
  first_item?: number | null;
  additional_item?: number | null;

  // New field names (current API shape)
  first_item_price?: number | null;
  additional_item_price?: number | null;
}

export interface MerchizeVariantAttribute {
  name: string;
  type: string;
  value_text: string;
  value_code: string;
}

export interface MerchizeVariant {
  _id: string;
  sku: string;
  attributes: MerchizeVariantAttribute[] | null;
  shipping_prices: MerchizeShippingPrice[] | null;
  tiers: MerchizeTier[] | null;
  artwork_positions: unknown | null;
}

export interface MerchizeProductAttributeValue {
  text: string;
  code: string;
}

export interface MerchizeProductAttribute {
  status: string;
  hide_on_storefront: boolean;
  customized: boolean;
  is_preselected: boolean;
  name: string;
  type: string;
  values: MerchizeProductAttributeValue[];
}

export interface MerchizeProductionTime {
  min: number;
  max: number;
}

export interface MerchizeFulfillmentLocation {
  name: string;
  code: string;
}

export interface MerchizeProduct {
  _id: string;
  variants: MerchizeVariant[] | null;
  attributes: MerchizeProductAttribute[] | null;
  production_time: MerchizeProductionTime | null;
  sku: string;
  slug: string;
  title: string;
  thumbnail_link: string;
  fulfillment_location: MerchizeFulfillmentLocation | null;
  mockup_and_templates_link: string | null;
  printing_methods: unknown[];
}

export interface MerchizeCatalogPage {
  success: boolean;
  data: {
    limit: number;
    page: number;
    total: number;
    products: MerchizeProduct[];
  };
}

// --- Small helpers -----------------------------------------------------

const SAFETY_MAX_PAGES = 10_000; // absolute hard stop
const SAFETY_MAX_VARIANTS = 100_000; // hard cap for variants ingested per run

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  // Prisma JSON inputs for optional fields should be either a valid JSON value or undefined.
  // Returning undefined lets Prisma treat it as "no change" / default null at the DB level,
  // which avoids the strict `NullableJsonNullValueInput` typing issues.
  if (value === null || value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

function extractTierPrices(tiers: MerchizeTier[] | null | undefined) {
  const list = tiers ?? [];
  return {
    tier1: list.find((t) => t.name === 'tier1')?.price ?? null,
    tier2: list.find((t) => t.name === 'tier2')?.price ?? null,
    tier3: list.find((t) => t.name === 'tier3')?.price ?? null,
  };
}

// --- Fetch one page ----------------------------------------------------

async function fetchCatalogPage(
  page: number,
  limit = 50, // 🔧 default 50
): Promise<MerchizeCatalogPage> {
  if (!CATALOG_URL) {
    throw new Error('MERCHIZE_CATALOG_URL is not set');
  }
  if (!API_KEY) {
    throw new Error('MERCHIZE_API_KEY is not set');
  }

  // clamp to [1, 50] because API demands limit <= 50
  const safeLimit = Math.min(Math.max(limit, 1), 50);

  const url = new URL(CATALOG_URL);
  url.searchParams.set('page', String(page));
  url.searchParams.set('limit', String(safeLimit));

  const res = await fetch(url.toString(), {
    headers: {
      'X-API-KEY': API_KEY,
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Merchize catalog API failed: ${res.status} ${res.statusText}${
        text ? ` - ${text.slice(0, 200)}` : ''
      }`,
    );
  }

  const json = (await res.json()) as MerchizeCatalogPage;
  if (!json.success || !json.data) {
    throw new Error('Merchize catalog API returned unsuccessful response');
  }

  return json;
}

// --- Per-product + per-variant upsert helpers --------------------------

async function upsertProduct(product: MerchizeProduct) {
  const merchizeProductId = String(product._id);

  const dataBase = {
    merchizeId: merchizeProductId,
    skuPrefix: product.sku ?? null,
    title: product.title ?? null,
    slug: product.slug ?? null,
    thumbUrl: product.thumbnail_link ?? null,
    fulfillCode: product.fulfillment_location?.code ?? null,
    fulfillName: product.fulfillment_location?.name ?? null,
    productionMin: product.production_time?.min ?? null,
    productionMax: product.production_time?.max ?? null,
    printingJson: toJsonValue(product.printing_methods ?? null),
    attributesJson: toJsonValue(product.attributes ?? null),
    mockupUrl: product.mockup_and_templates_link ?? null,
  };

  return merchizeCatalogPrisma.product.upsert({
    where: { merchizeId: merchizeProductId },
    create: dataBase,
    update: dataBase,
  });
}

async function upsertVariantAndBands(productRecordId: string, variant: MerchizeVariant) {
  const merchizeVariantId = String(variant._id);
  const { tier1, tier2, tier3 } = extractTierPrices(variant.tiers);

  const variantDataBase = {
    merchizeId: merchizeVariantId,
    sku: variant.sku,
    productId: productRecordId,
    attributesJson: toJsonValue(variant.attributes ?? null),
    tiersJson: toJsonValue(variant.tiers ?? null),
    tier1Price: tier1,
    tier2Price: tier2,
    tier3Price: tier3,
  };

  const variantRecord = await merchizeCatalogPrisma.variant.upsert({
    where: { merchizeId: merchizeVariantId },
    create: variantDataBase,
    update: variantDataBase,
  });

  const bands: MerchizeShippingPrice[] = variant.shipping_prices ?? [];
  for (const s of bands) {
    // Support both old (first_item/additional_item) and new (first_item_price/additional_item_price) field names.
    // Use null only when all candidates are undefined; keep 0 as a valid "free shipping" value.
    const first = s.first_item ?? s.first_item_price ?? null;
    const addl = s.additional_item ?? s.additional_item_price ?? null;

    await merchizeCatalogPrisma.shippingBand.upsert({
      where: {
        variantId_toZone: {
          variantId: variantRecord.id,
          toZone: s.to_zone,
        },
      },
      create: {
        variantId: variantRecord.id,
        toZone: s.to_zone,
        firstItem: first,
        addlItem: addl,
      },
      update: {
        firstItem: first,
        addlItem: addl,
      },
    });
  }

  return 1; // number of variants ingested
}

// --- Main sync ---------------------------------------------------------

export async function refreshMerchizeCatalog() {
  const startedAt = new Date();
  let page = 1;
  let ingestedVariants = 0;
  let totalProducts = 0;

  // Simple log so you can see when a run starts in the server logs
  console.log('[MerchizeCatalog] Refresh started at', startedAt.toISOString());

  try {
    // loop over catalog pages until we reach the last page or safety caps
    while (page <= SAFETY_MAX_PAGES && ingestedVariants < SAFETY_MAX_VARIANTS) {
      const { data } = await fetchCatalogPage(page);
      const { products, total, page: currentPage, limit: pageLimit } = data;

      totalProducts = total;
      if (!products || products.length === 0) {
        console.log(`[MerchizeCatalog] No products found on page ${currentPage}, stopping sync.`);
        break;
      }

      console.log(
        `[MerchizeCatalog] Page ${currentPage} of ~${Math.ceil(
          total / pageLimit,
        )} (${products.length} products, total=${total})`,
      );

      // Process this page's products sequentially to keep memory lower
      for (const product of products) {
        const productRecord = await upsertProduct(product);
        const variants: MerchizeVariant[] = product.variants ?? [];

        for (const v of variants) {
          ingestedVariants += await upsertVariantAndBands(productRecord.id, v);

          // Safety cap – bail out if we somehow hit a huge catalog
          if (ingestedVariants >= SAFETY_MAX_VARIANTS) {
            console.warn(
              `[MerchizeCatalog] Reached SAFETY_MAX_VARIANTS (${SAFETY_MAX_VARIANTS}), aborting further ingestion.`,
            );
            break;
          }
        }

        if (ingestedVariants >= SAFETY_MAX_VARIANTS) break;
      }

      // compute if we have reached the last page
      const lastPage = Math.ceil(total / pageLimit);
      if (currentPage >= lastPage) {
        console.log(`[MerchizeCatalog] Reached last page (${currentPage}/${lastPage}), stopping.`);
        break;
      }

      page += 1;
    }

    const now = new Date();
    await merchizeCatalogPrisma.syncState.upsert({
      where: { id: 'merchize_catalog' },
      create: {
        id: 'merchize_catalog',
        lastPage: page,
        lastTotal: totalProducts,
        lastRunAt: now,
        lastSuccessAt: now,
      },
      update: {
        lastPage: page,
        lastTotal: totalProducts,
        lastRunAt: now,
        lastSuccessAt: now,
      },
    });

    console.log(
      `[MerchizeCatalog] Refresh completed: pagesProcessed=${page}, variants=${ingestedVariants}, totalProducts=${totalProducts}`,
    );

    return { ingestedVariants, totalProducts };
  } catch (err) {
    const now = new Date();
    console.error('[MerchizeCatalog] Refresh failed:', err);

    // still record that a run was attempted
    await merchizeCatalogPrisma.syncState.upsert({
      where: { id: 'merchize_catalog' },
      create: {
        id: 'merchize_catalog',
        lastPage: page,
        lastTotal: totalProducts,
        lastRunAt: now,
        lastSuccessAt: null,
      },
      update: {
        lastPage: page,
        lastTotal: totalProducts,
        lastRunAt: now,
        // keep lastSuccessAt as-is on failure
      },
    });

    throw err;
  }
}

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
  first_item: number | null;
  additional_item: number | null;
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

// --- Fetch one page ----------------------------------------------------

async function fetchCatalogPage(
  page: number,
  limit = 50, // 🔧 default 50
): Promise<MerchizeCatalogPage> {
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

  console.log(`---RESPONSE from [fetchCatalogPage] server action \n`, res.json(), '\n');

  if (!res.ok) {
    throw new Error(`Merchize catalog API failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as MerchizeCatalogPage;
  return json;
}

// --- Main sync ---------------------------------------------------------

export async function refreshMerchizeCatalog() {
  let page = 1;
  let ingestedVariants = 0;
  let totalProducts = 0;

  const now = new Date();
  const SAFETY_MAX_PAGES = 10_000;

  while (page <= SAFETY_MAX_PAGES) {
    const { success, data } = await fetchCatalogPage(page);
    if (!success) break;

    const { products, total, page: currentPage, limit: pageLimit, total: totalCount } = data;

    totalProducts = total ?? totalProducts;

    if (!products || products.length === 0) break;

    for (const product of products) {
      const merchizeProductId = String(product._id);

      const productRecord = await merchizeCatalogPrisma.product.upsert({
        where: { merchizeId: merchizeProductId },
        create: {
          merchizeId: merchizeProductId,
          skuPrefix: product.sku ?? null,
          title: product.title ?? null,
          slug: product.slug ?? null,
          thumbUrl: product.thumbnail_link ?? null,
          fulfillCode: product.fulfillment_location?.code ?? null,
          fulfillName: product.fulfillment_location?.name ?? null,
          productionMin: product.production_time?.min ?? null,
          productionMax: product.production_time?.max ?? null,
          printingJson: (product.printing_methods ?? null) as unknown as Prisma.InputJsonValue,
          attributesJson: (product.attributes ?? null) as unknown as Prisma.InputJsonValue,
          mockupUrl: product.mockup_and_templates_link ?? null,
        },
        update: {
          skuPrefix: product.sku ?? null,
          title: product.title ?? null,
          slug: product.slug ?? null,
          thumbUrl: product.thumbnail_link ?? null,
          fulfillCode: product.fulfillment_location?.code ?? null,
          fulfillName: product.fulfillment_location?.name ?? null,
          productionMin: product.production_time?.min ?? null,
          productionMax: product.production_time?.max ?? null,
          printingJson: (product.printing_methods ?? null) as unknown as Prisma.InputJsonValue,
          attributesJson: (product.attributes ?? null) as unknown as Prisma.InputJsonValue,
          mockupUrl: product.mockup_and_templates_link ?? null,
        },
      });

      const variants: MerchizeVariant[] = product.variants ?? [];

      for (const v of variants) {
        const merchizeVariantId = String(v._id);
        const tiers: MerchizeTier[] = v.tiers ?? [];

        const tier1 = tiers.find((t) => t.name === 'tier1')?.price ?? null;
        const tier2 = tiers.find((t) => t.name === 'tier2')?.price ?? null;
        const tier3 = tiers.find((t) => t.name === 'tier3')?.price ?? null;

        const variantRecord = await merchizeCatalogPrisma.variant.upsert({
          where: { merchizeId: merchizeVariantId },
          create: {
            merchizeId: merchizeVariantId,
            sku: v.sku,
            productId: productRecord.id,
            attributesJson: (v.attributes ?? null) as unknown as Prisma.InputJsonValue,
            tiersJson: (tiers ?? null) as unknown as Prisma.InputJsonValue,
            tier1Price: tier1,
            tier2Price: tier2,
            tier3Price: tier3,
          },
          update: {
            sku: v.sku,
            productId: productRecord.id,
            attributesJson: (v.attributes ?? null) as unknown as Prisma.InputJsonValue,
            tiersJson: (tiers ?? null) as unknown as Prisma.InputJsonValue,
            tier1Price: tier1,
            tier2Price: tier2,
            tier3Price: tier3,
          },
        });

        const bands: MerchizeShippingPrice[] = v.shipping_prices ?? [];
        for (const s of bands) {
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
              firstItem: s.first_item ?? null,
              addlItem: s.additional_item ?? null,
            },
            update: {
              firstItem: s.first_item ?? null,
              addlItem: s.additional_item ?? null,
            },
          });
        }

        ingestedVariants += 1;
      }
    }

    // stop when we've reached or gone past the last page
    const effectiveTotal = totalCount ?? totalProducts;
    if (currentPage * pageLimit >= effectiveTotal) break;

    page += 1;
  }

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

  return { ingestedVariants, totalProducts };
}

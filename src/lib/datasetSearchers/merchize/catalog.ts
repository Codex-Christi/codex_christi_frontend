// src/lib/datasetSearchers/merchize/catalog.ts
import { merchizeCatalogPrisma } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';
import {
  createDemandCatalogResolver,
  type SupplierShippingBand,
} from '@/lib/merchizeCatalog/currentEvidence';
import type {
  Prisma,
  Product,
  Variant,
  ShippingBand,
} from '../../../lib/prisma/shop/merchize/generated/merchizeCatalog/client';

// Shape compatible with your old JSON catalog
export type CatalogItem = {
  shippingBands?: SupplierShippingBand[];
  SKU_product: string;
  SKU_variant: string;

  tier_1_price: number | null;
  tier_2_price: number | null;
  tier_3_price: number | null;

  US_shipping_fee: number | null;
  US_additional_shipping_fee: number | null;

  EU_shipping_fee: number | null;
  EU_additional_shipping_fee: number | null;

  GB_shipping_fee: number | null;
  GB_additional_shipping_fee: number | null;

  CA_shipping_fee: number | null;
  CA_additional_shipping_fee: number | null;

  AU_shipping_fee: number | null;
  AU_additional_shipping_fee: number | null;

  ROW_shipping_fee: number | null;
  ROW_additional_shipping_fee: number | null;
};

export type StrictCatalogVariantRecord = {
  sku: string;
  supplierProductId: string;
  supplierVariantId: string;
  catalogRow: CatalogItem;
};

export class MissingMerchizeCatalogSkuError extends Error {
  readonly code = 'MISSING_MERCHIZE_CATALOG_SKU' as const;
  readonly missingSkus: string[];

  constructor(missingSkus: string[]) {
    super(`Merchize catalog rows are missing for: ${missingSkus.join(', ')}.`);
    this.name = 'MissingMerchizeCatalogSkuError';
    this.missingSkus = missingSkus;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CurrentMerchizeCatalogGenerationUnavailableError extends Error {
  readonly code = 'CURRENT_MERCHIZE_CATALOG_GENERATION_UNAVAILABLE' as const;

  constructor() {
    super('Current product-scoped Merchize supplier evidence is unavailable.');
    this.name = 'CurrentMerchizeCatalogGenerationUnavailableError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type CurrentCatalogVariantLookup = {
  generationAvailable: boolean;
  variant: StrictCatalogVariantRecord | null;
};

export type CurrentCatalogVariantBatchLookup = {
  generationAvailable: boolean;
  unverifiedSkus?: string[];
  variants: StrictCatalogVariantRecord[];
};

export const DEFAULT_MERCHIZE_CATALOG_CURRENT_MAX_AGE_HOURS = 48;

function configuredCatalogCurrentMaxAgeMs() {
  const raw = process.env.MERCHIZE_CATALOG_CURRENT_MAX_AGE_HOURS?.trim();
  const configured = raw ? Number(raw) : Number.NaN;
  const hours = Number.isFinite(configured)
    ? Math.min(Math.max(configured, 1), 24 * 14)
    : DEFAULT_MERCHIZE_CATALOG_CURRENT_MAX_AGE_HOURS;
  return hours * 60 * 60 * 1_000;
}

export function isMerchizeCatalogGenerationCurrent(
  generation: {
    lastCompletedRunId: string | null;
    lastCompletedAt: Date | null;
    activeRunId?: string | null;
  } | null,
  now = new Date(),
  maxAgeMs = configuredCatalogCurrentMaxAgeMs(),
) {
  const runId = generation?.lastCompletedRunId?.trim();
  const completedAt = generation?.lastCompletedAt;
  if (!runId || !completedAt || generation?.activeRunId?.trim()) return false;
  const ageMs = now.getTime() - completedAt.getTime();
  return ageMs >= 0 && ageMs <= maxAgeMs;
}

type CatalogGenerationRow = {
  catalogCurrent: boolean;
  catalogLastSeenRunId: string | null;
};

/**
 * `catalogCurrent` alone is insufficient: an expired writer can resume after a newer generation
 * commits. A row is authoritative only when both it and its parent were written by the exact
 * generation named by SyncState.
 */
export function isCatalogRowInCompletedGeneration(
  variant: CatalogGenerationRow,
  product: CatalogGenerationRow | null,
  completedRunId: string,
) {
  return (
    variant.catalogCurrent === true &&
    variant.catalogLastSeenRunId === completedRunId &&
    product?.catalogCurrent === true &&
    product.catalogLastSeenRunId === completedRunId
  );
}

export function buildStrictCatalogGenerationWhere(
  skus: string[],
  completedRunId: string,
): Prisma.VariantWhereInput {
  return {
    sku: { in: skus },
    catalogCurrent: true,
    catalogLastSeenRunId: completedRunId,
    product: {
      catalogCurrent: true,
      catalogLastSeenRunId: completedRunId,
    },
  };
}

// Helper to pick a band by zone ("US", "EU", "GB", ...)
function bandForZone(bands: ShippingBand[], zone: string): ShippingBand | undefined {
  return bands.find((b) => b.toZone === zone);
}

// Map a Variant (+product, +bands) into your CatalogItem shape
function toCatalogItemFromDb(
  variant: Variant & { product: Product | null; shippingBands: ShippingBand[] },
): CatalogItem {
  const us = bandForZone(variant.shippingBands, 'US');
  const eu = bandForZone(variant.shippingBands, 'EU');
  const gb = bandForZone(variant.shippingBands, 'GB');
  const ca = bandForZone(variant.shippingBands, 'CA');
  const au = bandForZone(variant.shippingBands, 'AU');
  const row = bandForZone(variant.shippingBands, 'ROW');

  return {
    SKU_product: variant.product?.skuPrefix ?? variant.product?.merchizeId ?? '',
    SKU_variant: variant.sku,

    tier_1_price: variant.tier1Price ?? null,
    tier_2_price: variant.tier2Price ?? null,
    tier_3_price: variant.tier3Price ?? null,

    US_shipping_fee: us?.firstItem ?? null,
    US_additional_shipping_fee: us?.addlItem ?? null,

    EU_shipping_fee: eu?.firstItem ?? null,
    EU_additional_shipping_fee: eu?.addlItem ?? null,

    GB_shipping_fee: gb?.firstItem ?? null,
    GB_additional_shipping_fee: gb?.addlItem ?? null,

    CA_shipping_fee: ca?.firstItem ?? null,
    CA_additional_shipping_fee: ca?.addlItem ?? null,

    AU_shipping_fee: au?.firstItem ?? null,
    AU_additional_shipping_fee: au?.addlItem ?? null,

    ROW_shipping_fee: row?.firstItem ?? null,
    ROW_additional_shipping_fee: row?.addlItem ?? null,
  };
}

/**
 * Get a single CatalogItem by full variant SKU.
 * Used anywhere you want data for exactly one SKU.
 */
export async function getVariantSKUCatalogData(
  variant_SKU: string,
): Promise<CatalogItem | undefined> {
  const v = await merchizeCatalogPrisma.variant.findUnique({
    where: { sku: variant_SKU },
    include: { product: true, shippingBands: true },
  });

  if (!v) return undefined;
  return toCatalogItemFromDb(v);
}

/**
 * Get multiple CatalogItems by an array of variant SKUs.
 *
 * IMPORTANT:
 * - It preserves multiplicity: if `skus` has duplicates (because of quantity),
 *   we will return the same CatalogItem multiple times.
 * - If any SKU is missing in the DB, we throw, so the caller can handle it.
 */
export async function getMultipleSKUsData(skus: string[]): Promise<CatalogItem[]> {
  if (!skus.length) return [];

  // unique set for DB query
  const unique = Array.from(new Set(skus));

  const variants = await merchizeCatalogPrisma.variant.findMany({
    where: { sku: { in: unique } },
    include: { product: true, shippingBands: true },
  });

  const bySku = new Map<
    string,
    Variant & { product: Product | null; shippingBands: ShippingBand[] }
  >();
  for (const v of variants) {
    bySku.set(v.sku, v);
  }

  const missing: string[] = [];
  const result: CatalogItem[] = [];

  for (const sku of skus) {
    const v = bySku.get(sku);

    if (!v) {
      missing.push(sku);
      continue;
    }
    result.push(toCatalogItemFromDb(v));
  }

  if (missing.length) {
    console.warn(
      `[AUDIT] Catalog rows missing for ${missing.length} SKUs. Missing SKUs: ${missing.join(', ')}`,
    );
  }

  return result;
}

/**
 * Checkout-only catalog lookup. Unlike the display/preview-compatible helper above, this is
 * deliberately fail-closed and returns the catalog product/variant identity that proves the SKU.
 */
export async function getStrictCatalogVariantsBySku(
  skus: string[],
): Promise<StrictCatalogVariantRecord[]> {
  const uniqueSkus = [...new Set(skus.map((sku) => sku.trim()).filter(Boolean))].sort();
  if (!uniqueSkus.length) return [];

  const result = await createDemandCatalogResolver().resolve(uniqueSkus);
  if (!result.generationAvailable) {
    throw new CurrentMerchizeCatalogGenerationUnavailableError();
  }
  const bySku = new Map(result.variants.map((variant) => [variant.sku, variant]));
  const missingSkus = uniqueSkus.filter((sku) => !bySku.has(sku));
  if (missingSkus.length) throw new MissingMerchizeCatalogSkuError(missingSkus);

  return uniqueSkus.map((sku) => bySku.get(sku)!);
}

/**
 * Missing-Product variants require exact SKU membership in fresh product-scoped supplier evidence.
 * Historical full-catalog rows supply search hints only, never positive sellability evidence.
 */
export async function getCurrentCatalogVariantBySku(
  rawSku: string,
): Promise<CurrentCatalogVariantLookup> {
  const sku = rawSku.trim();
  const batch = await getCurrentCatalogVariantsBySku(sku ? [sku] : []);
  return {
    generationAvailable: batch.generationAvailable,
    variant: batch.variants[0] ?? null,
  };
}

export async function getCurrentCatalogVariantsBySku(
  rawSkus: string[],
): Promise<CurrentCatalogVariantBatchLookup> {
  return createDemandCatalogResolver().resolve(rawSkus);
}

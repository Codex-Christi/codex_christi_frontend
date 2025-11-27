// src/actions/merchize/getItemCatalogInfo.ts
'use server';

import {
  getMultipleSKUsData,
  getVariantSKUCatalogData,
  type CatalogItem,
} from '@/lib/datasetSearchers/merchize/catalog';
import type { ShippingCountryObj } from '@/lib/datasetSearchers/shippingSupportMerchize';

/**
 * Get a single catalog row for a single SKU.
 * Returns null if no matching SKU exists in the local catalog DB.
 */
export async function getCatalogItem(sku: string): Promise<CatalogItem | null> {
  const item = await getVariantSKUCatalogData(sku);
  return item ?? null;
}

/**
 * Get catalog rows for multiple SKUs.
 *
 * NOTE:
 * - The function signature is kept compatible with existing callers:
 *   getCatalogItems(skus, country_iso3)
 * - The second parameter `_country_iso3` is currently unused here,
 *   because region selection is handled later in the shipping
 *   calculation (getShippingPriceMerchizecatalog via iso3ToDest).
 * - We keep the parameter so you don't have to update call sites.
 */
export async function getCatalogItems(
  skus: string[],
  _country_iso3?: ShippingCountryObj['country_iso3'],
): Promise<CatalogItem[]> {
  if (!skus.length) return [];
  return await getMultipleSKUsData(skus);
}

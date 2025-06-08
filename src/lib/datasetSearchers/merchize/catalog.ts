import fs from 'fs/promises';
import path from 'path';

export type CatalogItem = {
  SKU_product: string;
  SKU_variant: string;
  tier_1_price: number;
  tier_2_price: number;
  tier_3_price: number;
  US_shipping_fee: number | null;
  US_additional_shipping_fee: number | null;
  EU_shipping_fee: number | null;
  EU_additional_shipping_fee: number | null;
  ROW_shipping_fee: number | null;
  ROW_additional_shipping_fee: number | null;
  // ...other fields
};

let catalogMap: Map<string, CatalogItem> | null = null;

export async function loadCatalog() {
  if (catalogMap) return catalogMap;
  const json = await fs.readFile(
    path.join(process.cwd(), 'src/datasets/merchize/sku_catalog.json'),
    'utf8'
  );
  const arr: CatalogItem[] = JSON.parse(json);
  catalogMap = new Map(arr.map((item) => [item.SKU_variant, item]));
  return catalogMap;
}

/**
 * Gets a single CatalogItem by variant string.
 */
export async function getVariantSKUCatalogData(
  variant_SKU: string
): Promise<CatalogItem | undefined> {
  const map = await loadCatalog();
  return map.get(variant_SKU);
}

/**
 * Gets multiple CatalogItems by an array of variant strings.
 */
export async function getMultipleSKUsData(
  multiple_SKUs: string[]
): Promise<CatalogItem[]> {
  const map = await loadCatalog();
  return multiple_SKUs
    .map((v) => map.get(v))
    .filter((item): item is CatalogItem => !!item); // filters out undefined
}

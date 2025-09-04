// Adapter that exposes the legacy API backed by the new dataset.
import type { CatalogItem } from './shipping.types';
import { loadNormalizedRows, toCatalogItem } from './shipping.data';

let catalogMap: Map<string, CatalogItem> | null = null;

export async function loadCatalog(): Promise<Map<string, CatalogItem>> {
  if (catalogMap) return catalogMap;
  const rows = await loadNormalizedRows();
  catalogMap = new Map(rows.map((r) => [r.sku, toCatalogItem(r)]));
  return catalogMap;
}

export async function getVariantSKUCatalogData(
  variant_SKU: string,
): Promise<CatalogItem | undefined> {
  const map = await loadCatalog();
  return map.get(variant_SKU);
}

export async function getMultipleSKUsData(multiple_SKUs: string[]): Promise<CatalogItem[]> {
  const map = await loadCatalog();
  return multiple_SKUs.map((v) => map.get(v)).filter((x): x is CatalogItem => !!x);
}

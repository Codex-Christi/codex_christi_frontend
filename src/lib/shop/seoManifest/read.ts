import fs from 'fs/promises';
import {
  getCategorySeoManifestPath,
  getProductSeoManifestPath,
  getShopSeoManifestGenerationsRoot,
  getShopSeoManifestIndexPath,
  getShopSeoManifestRoot,
} from './paths';
import {
  SHOP_SEO_MANIFEST_SCHEMA_VERSION,
  SHOP_SEO_MANIFEST_PROVIDER_MERCHIZE,
  type CategorySeoManifestEntry,
  type ProductSeoManifestEntry,
  type ShopSeoManifestIndex,
  type ShopSeoManifestStats,
} from './types';

export async function readProductSeoManifestEntry(productId: string) {
  const index = await readShopSeoManifestIndex();
  if (!index) return null;

  const entry = await readJsonFile<ProductSeoManifestEntry>(
    getProductSeoManifestPath(index.activeGeneration, productId),
  );

  return isProductSeoManifestEntry(entry) ? entry : null;
}

export async function readCategorySeoManifestEntry(categorySlug: string) {
  const index = await readShopSeoManifestIndex();
  if (!index) return null;

  const entry = await readJsonFile<CategorySeoManifestEntry>(
    getCategorySeoManifestPath(index.activeGeneration, categorySlug),
  );

  return isCategorySeoManifestEntry(entry) ? entry : null;
}

export async function readShopSeoManifestStats(): Promise<ShopSeoManifestStats> {
  const index = await readShopSeoManifestIndex();
  const retainedGenerationCount = await countRetainedGenerations().catch(() => 0);

  return {
    activeGeneration: index?.activeGeneration ?? null,
    generatedAt: index?.generatedAt ?? null,
    productCount: index?.productCount ?? 0,
    categoryCount: index?.categoryCount ?? 0,
    missingPublishedProductIds: index?.missingPublishedProductIds ?? [],
    missingCategorySlugs: index?.missingCategorySlugs ?? [],
    manifestPath: getShopSeoManifestRoot(),
    retainedGenerationCount:
      index?.retainedGenerationCount ?? retainedGenerationCount,
    lastPrunedGenerationCount: index?.lastPrunedGenerationCount ?? 0,
    warnings: Array.isArray(index?.warnings) ? index.warnings : [],
  };
}

async function readShopSeoManifestIndex() {
  const index = await readJsonFile<ShopSeoManifestIndex>(getShopSeoManifestIndexPath());
  return isShopSeoManifestIndex(index) ? index : null;
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch (error) {
    if (isFileNotFound(error)) return null;
    throw error;
  }
}

async function countRetainedGenerations() {
  const entries = await fs.readdir(getShopSeoManifestGenerationsRoot(), {
    withFileTypes: true,
  });

  return entries.filter((entry) => entry.isDirectory()).length;
}

function isFileNotFound(error: unknown) {
  return (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}

function isShopSeoManifestIndex(value: unknown): value is ShopSeoManifestIndex {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    (value as ShopSeoManifestIndex).schemaVersion === SHOP_SEO_MANIFEST_SCHEMA_VERSION &&
    typeof (value as ShopSeoManifestIndex).activeGeneration === 'string' &&
    typeof (value as ShopSeoManifestIndex).generatedAt === 'string'
  );
}

function isProductSeoManifestEntry(value: unknown): value is ProductSeoManifestEntry {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    (value as ProductSeoManifestEntry).schemaVersion === SHOP_SEO_MANIFEST_SCHEMA_VERSION &&
    (value as ProductSeoManifestEntry).kind === 'product' &&
    (value as ProductSeoManifestEntry).provider === SHOP_SEO_MANIFEST_PROVIDER_MERCHIZE &&
    typeof (value as ProductSeoManifestEntry).id === 'string' &&
    typeof (value as ProductSeoManifestEntry).title === 'string' &&
    typeof (value as ProductSeoManifestEntry).description === 'string'
  );
}

function isCategorySeoManifestEntry(value: unknown): value is CategorySeoManifestEntry {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    (value as CategorySeoManifestEntry).schemaVersion === SHOP_SEO_MANIFEST_SCHEMA_VERSION &&
    (value as CategorySeoManifestEntry).kind === 'category' &&
    (value as CategorySeoManifestEntry).provider === SHOP_SEO_MANIFEST_PROVIDER_MERCHIZE &&
    typeof (value as CategorySeoManifestEntry).slug === 'string' &&
    typeof (value as CategorySeoManifestEntry).name === 'string' &&
    typeof (value as CategorySeoManifestEntry).description === 'string'
  );
}

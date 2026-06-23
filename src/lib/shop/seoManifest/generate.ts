import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { merchizeCatalogPrisma } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';
import { STOREFRONT_SNAPSHOT_CATEGORY_SLUGS } from '@/lib/merchizeStorefront/categories';
import { normalizeStorefrontCategorySlug } from '@/lib/merchizeStorefront/snapshot';
import { getShopSiteUrl } from '@/lib/siteBaseUrls';
import { extractProductMetaDescriptionFromHtml } from '@/lib/utils/extract-plain-text-from-html';
import { getCategoryPagePath } from '@/lib/utils/shop/categoryPagePath';
import {
  PUBLISHED_SHOP_PRODUCT_IDS,
  getPublishedShopProductPreview,
} from '@/lib/utils/shopHomePageProductsData';
import {
  getShopSeoManifestGenerationPath,
  getShopSeoManifestIndexPath,
  getShopSeoManifestRoot,
  toManifestFileName,
} from './paths';
import {
  SHOP_SEO_MANIFEST_PROVIDER_MERCHIZE,
  SHOP_SEO_MANIFEST_SCHEMA_VERSION,
  type CategorySeoManifestEntry,
  type ProductSeoManifestEntry,
  type ShopSeoManifestGenerationResult,
  type ShopSeoManifestIndex,
} from './types';

type ProductSnapshotRow = Awaited<
  ReturnType<typeof getProductSnapshotRows>
>[number];

type CategorySnapshotRow = Awaited<
  ReturnType<typeof getCategorySnapshotRows>
>[number];

export async function generateShopSeoManifest(): Promise<ShopSeoManifestGenerationResult> {
  const generatedAt = new Date().toISOString();
  const generation = `${generatedAt.replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0, 8)}`;
  const tempGenerationPath = path.join(getShopSeoManifestRoot(), `.tmp-${generation}`);
  const activeGenerationPath = getShopSeoManifestGenerationPath(generation);

  const [productRows, categoryRows] = await Promise.all([
    getProductSnapshotRows(),
    getCategorySnapshotRows(),
  ]);

  const productEntries = buildProductEntries(productRows, generatedAt);
  const categoryEntries = buildCategoryEntries(categoryRows, generatedAt);
  const missingPublishedProductIds = PUBLISHED_SHOP_PRODUCT_IDS.filter(
    (productId) => !productRows.some((row) => row.merchizeProductId === productId),
  );
  const missingCategorySlugs = STOREFRONT_SNAPSHOT_CATEGORY_SLUGS.filter(
    (categorySlug) =>
      !categoryRows.some(
        (row) => normalizeStorefrontCategorySlug(row.categorySlug) === categorySlug,
      ),
  );

  for (const productId of missingPublishedProductIds) {
    const fallback = getPublishedShopProductPreview(productId);
    if (!fallback) continue;
    productEntries.set(productId, {
      schemaVersion: SHOP_SEO_MANIFEST_SCHEMA_VERSION,
      kind: 'product',
      provider: SHOP_SEO_MANIFEST_PROVIDER_MERCHIZE,
      id: productId,
      route: `/shop/product/${encodeURIComponent(productId)}`,
      title: fallback.title,
      description: `Shop ${fallback.title} from Codex Christi.`,
      image: resolveImageUrl(fallback.imagePath),
      price: fallback.retailPrice,
      currency: 'USD',
      source: 'published_fallback',
      updatedAt: generatedAt,
    });
  }

  for (const categorySlug of missingCategorySlugs) {
    categoryEntries.set(categorySlug, {
      schemaVersion: SHOP_SEO_MANIFEST_SCHEMA_VERSION,
      kind: 'category',
      provider: SHOP_SEO_MANIFEST_PROVIDER_MERCHIZE,
      slug: categorySlug,
      route: getCategoryPagePath(categorySlug, 1),
      name: displayCategoryName(categorySlug),
      description: `Shop ${displayCategoryName(categorySlug)} from Codex Christi.`,
      cover: null,
      totalPages: null,
      source: 'category_fallback',
      updatedAt: generatedAt,
    });
  }

  const productList = [...productEntries.values()];
  const categoryList = [...categoryEntries.values()];
  validateManifestEntries(productList, categoryList);

  await fs.rm(tempGenerationPath, { recursive: true, force: true });
  await writeManifestFiles(tempGenerationPath, productList, categoryList);
  await fs.mkdir(path.dirname(activeGenerationPath), { recursive: true });
  await fs.rename(tempGenerationPath, activeGenerationPath);

  const index: ShopSeoManifestIndex = {
    schemaVersion: SHOP_SEO_MANIFEST_SCHEMA_VERSION,
    activeGeneration: generation,
    generatedAt,
    productCount: productList.length,
    categoryCount: categoryList.length,
    missingPublishedProductIds,
    missingCategorySlugs,
  };

  await writeJsonAtomic(getShopSeoManifestIndexPath(), index);

  const affectedRoutes = [
    ...productList.map((entry) => entry.route),
    ...categoryList.flatMap((entry) => getCategoryRevalidationPaths(entry)),
  ];

  return {
    ok: missingPublishedProductIds.length === 0 && missingCategorySlugs.length === 0,
    activeGeneration: generation,
    generatedAt,
    productCount: productList.length,
    categoryCount: categoryList.length,
    missingPublishedProductIds,
    missingCategorySlugs,
    manifestPath: getShopSeoManifestRoot(),
    affectedRoutes: [...new Set(['/shop', ...affectedRoutes])],
  };
}

async function getProductSnapshotRows() {
  return merchizeCatalogPrisma.storefrontProductSnapshot.findMany({
    select: {
      merchizeProductId: true,
      title: true,
      description: true,
      image: true,
      retailPrice: true,
      updatedAt: true,
    },
    orderBy: { lastSeenAt: 'desc' },
  });
}

async function getCategorySnapshotRows() {
  return merchizeCatalogPrisma.storefrontCategorySnapshot.findMany({
    select: {
      categorySlug: true,
      name: true,
      description: true,
      coverUrl: true,
      totalPages: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
}

function buildProductEntries(rows: ProductSnapshotRow[], generatedAt: string) {
  const entries = new Map<string, ProductSeoManifestEntry>();

  for (const row of rows) {
    const title = row.title?.trim() || 'Product';
    entries.set(row.merchizeProductId, {
      schemaVersion: SHOP_SEO_MANIFEST_SCHEMA_VERSION,
      kind: 'product',
      provider: SHOP_SEO_MANIFEST_PROVIDER_MERCHIZE,
      id: row.merchizeProductId,
      route: `/shop/product/${encodeURIComponent(row.merchizeProductId)}`,
      title,
      description: extractProductMetaDescriptionFromHtml(row.description, title),
      image: resolveImageUrl(row.image),
      price: formatPrice(row.retailPrice),
      currency: 'USD',
      source: 'snapshot',
      updatedAt: row.updatedAt?.toISOString() ?? generatedAt,
    });
  }

  return entries;
}

function buildCategoryEntries(rows: CategorySnapshotRow[], generatedAt: string) {
  const entries = new Map<string, CategorySeoManifestEntry>();

  for (const row of rows) {
    const slug = normalizeStorefrontCategorySlug(row.categorySlug);
    const name = row.name?.trim() || displayCategoryName(slug);
    entries.set(slug, {
      schemaVersion: SHOP_SEO_MANIFEST_SCHEMA_VERSION,
      kind: 'category',
      provider: SHOP_SEO_MANIFEST_PROVIDER_MERCHIZE,
      slug,
      route: getCategoryPagePath(slug, 1),
      name,
      description: row.description?.trim() || `Shop ${name} from Codex Christi.`,
      cover: resolveImageUrl(row.coverUrl),
      totalPages: row.totalPages ?? null,
      source: 'snapshot',
      updatedAt: row.updatedAt?.toISOString() ?? generatedAt,
    });
  }

  return entries;
}

async function writeManifestFiles(
  generationPath: string,
  products: ProductSeoManifestEntry[],
  categories: CategorySeoManifestEntry[],
) {
  await Promise.all([
    fs.mkdir(
      path.join(generationPath, 'providers', SHOP_SEO_MANIFEST_PROVIDER_MERCHIZE, 'products', 'by-id'),
      { recursive: true },
    ),
    fs.mkdir(
      path.join(
        generationPath,
        'providers',
        SHOP_SEO_MANIFEST_PROVIDER_MERCHIZE,
        'categories',
        'by-slug',
      ),
      { recursive: true },
    ),
  ]);

  await Promise.all([
    ...products.map((entry) =>
      writeJsonFile(getProductSeoManifestPathFromRoot(generationPath, entry.id), entry),
    ),
    ...categories.map((entry) =>
      writeJsonFile(getCategorySeoManifestPathFromRoot(generationPath, entry.slug), entry),
    ),
  ]);
}

function getProductSeoManifestPathFromRoot(generationPath: string, productId: string) {
  return path.join(
    generationPath,
    'providers',
    SHOP_SEO_MANIFEST_PROVIDER_MERCHIZE,
    'products',
    'by-id',
    `merchize-product-${toManifestFileName(productId)}.seo.json`,
  );
}

function getCategorySeoManifestPathFromRoot(generationPath: string, categorySlug: string) {
  return path.join(
    generationPath,
    'providers',
    SHOP_SEO_MANIFEST_PROVIDER_MERCHIZE,
    'categories',
    'by-slug',
    `merchize-category-${toManifestFileName(categorySlug)}.seo.json`,
  );
}

async function writeJsonFile(filePath: string, value: unknown) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeJsonAtomic(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  await writeJsonFile(tempPath, value);
  await fs.rename(tempPath, filePath);
}

function validateManifestEntries(
  products: ProductSeoManifestEntry[],
  categories: CategorySeoManifestEntry[],
) {
  for (const product of products) {
    if (!product.id || !product.route || !product.title || !product.description) {
      throw new Error(`Invalid product SEO manifest entry: ${product.id || '(missing id)'}`);
    }
  }

  for (const category of categories) {
    if (!category.slug || !category.route || !category.name || !category.description) {
      throw new Error(`Invalid category SEO manifest entry: ${category.slug || '(missing slug)'}`);
    }
  }
}

function getCategoryRevalidationPaths(entry: CategorySeoManifestEntry) {
  const totalPages = Math.max(1, entry.totalPages ?? 1);
  return Array.from({ length: totalPages }, (_, index) =>
    getCategoryPagePath(entry.slug, index + 1),
  );
}

function resolveImageUrl(image: string | null | undefined) {
  if (!image) return null;
  if (image.startsWith('/')) return getShopSiteUrl(image);
  if (image.startsWith('http')) return image.replace(/\/thumb\.jpg(?:[?#].*)?$/i, '');
  return `https://d2dytk4tvgwhb4.cloudfront.net/${image}`.replace(/\/thumb\.jpg(?:[?#].*)?$/i, '');
}

function formatPrice(price: number | null | undefined) {
  return typeof price === 'number' && Number.isFinite(price) ? price.toFixed(2) : null;
}

function displayCategoryName(categorySlug: string) {
  return normalizeStorefrontCategorySlug(categorySlug)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

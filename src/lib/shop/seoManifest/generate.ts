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
  getShopSeoManifestGenerationLockPath,
  getShopSeoManifestGenerationPath,
  getShopSeoManifestGenerationsRoot,
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
  type ShopSeoManifestWarning,
} from './types';

const DEFAULT_RETAINED_SEO_MANIFEST_GENERATIONS = 5;
const DEFAULT_GENERATION_LOCK_STALE_MS = 15 * 60 * 1000;

type GenerateShopSeoManifestOptions = {
  retainGenerations?: number;
  lockStaleMs?: number;
};

type ProductSnapshotRow = Awaited<
  ReturnType<typeof getProductSnapshotRows>
>[number];

type CategorySnapshotRow = Awaited<
  ReturnType<typeof getCategorySnapshotRows>
>[number];

export class ShopSeoManifestGenerationLockError extends Error {
  readonly code = 'SHOP_SEO_MANIFEST_GENERATION_LOCKED';

  constructor(message: string) {
    super(message);
    this.name = 'ShopSeoManifestGenerationLockError';
  }
}

export async function generateShopSeoManifest(
  options: GenerateShopSeoManifestOptions = {},
): Promise<ShopSeoManifestGenerationResult> {
  return withSeoManifestGenerationLock(options, (lockWarnings) =>
    generateShopSeoManifestUnlocked(options, lockWarnings),
  );
}

async function generateShopSeoManifestUnlocked(
  options: GenerateShopSeoManifestOptions,
  lockWarnings: ShopSeoManifestWarning[],
): Promise<ShopSeoManifestGenerationResult> {
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

  const provisionalIndex: ShopSeoManifestIndex = {
    schemaVersion: SHOP_SEO_MANIFEST_SCHEMA_VERSION,
    activeGeneration: generation,
    generatedAt,
    productCount: productList.length,
    categoryCount: categoryList.length,
    missingPublishedProductIds,
    missingCategorySlugs,
    retainedGenerationCount: 0,
    lastPrunedGenerationCount: 0,
    warnings: lockWarnings,
  };

  await writeJsonAtomic(getShopSeoManifestIndexPath(), provisionalIndex);

  const pruneResult = await pruneSeoManifestGenerations({
    activeGeneration: generation,
    retainGenerations: resolveRetainedGenerationCount(options.retainGenerations),
    tempStaleMs: resolveGenerationLockStaleMs(options.lockStaleMs),
  });
  const warnings = [...lockWarnings, ...pruneResult.warnings];
  const index: ShopSeoManifestIndex = {
    ...provisionalIndex,
    retainedGenerationCount: pruneResult.retainedGenerationCount,
    lastPrunedGenerationCount: pruneResult.prunedGenerations.length,
    warnings,
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
    retainedGenerationCount: index.retainedGenerationCount,
    lastPrunedGenerationCount: index.lastPrunedGenerationCount,
    warnings,
    prunedGenerations: pruneResult.prunedGenerations,
    affectedRoutes: [...new Set(['/shop', ...affectedRoutes])],
  };
}

async function withSeoManifestGenerationLock<T>(
  options: GenerateShopSeoManifestOptions,
  run: (lockWarnings: ShopSeoManifestWarning[]) => Promise<T>,
) {
  const lockPath = getShopSeoManifestGenerationLockPath();
  const lockWarnings: ShopSeoManifestWarning[] = [];
  const staleMs = resolveGenerationLockStaleMs(options.lockStaleMs);
  const lockId = crypto.randomUUID();

  await fs.mkdir(path.dirname(lockPath), { recursive: true });

  let acquired = false;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await fs.mkdir(lockPath);
      acquired = true;
      break;
    } catch (error) {
      if (!isNodeErrorCode(error, 'EEXIST')) throw error;

      const existingLockAgeMs = await getExistingLockAgeMs(lockPath);
      if (existingLockAgeMs < staleMs) {
        throw new ShopSeoManifestGenerationLockError(
          `SEO manifest generation is already running. Lock age: ${Math.ceil(
            existingLockAgeMs / 1000,
          )}s.`,
        );
      }

      await fs.rm(lockPath, { recursive: true, force: true });
      lockWarnings.push({
        code: 'stale_lock_reclaimed',
        message: `Reclaimed stale SEO manifest generation lock after ${Math.ceil(
          existingLockAgeMs / 1000,
        )}s.`,
      });
    }
  }

  if (!acquired) {
    throw new ShopSeoManifestGenerationLockError(
      'SEO manifest generation lock could not be acquired.',
    );
  }

  try {
    try {
      await writeJsonFile(path.join(lockPath, 'lock.json'), {
        lockId,
        createdAt: new Date().toISOString(),
        pid: process.pid,
      });
    } catch (error) {
      await fs.rm(lockPath, { recursive: true, force: true });
      throw error;
    }

    return await run(lockWarnings);
  } finally {
    await fs.rm(lockPath, { recursive: true, force: true }).catch((error) => {
      console.error('[shopSeoManifest.lock.releaseFailed]', {
        error: formatErrorMessage(error),
      });
    });
  }
}

async function getExistingLockAgeMs(lockPath: string) {
  const now = Date.now();

  try {
    const raw = await fs.readFile(path.join(lockPath, 'lock.json'), 'utf8');
    const parsed = JSON.parse(raw) as { createdAt?: unknown };
    if (typeof parsed.createdAt === 'string') {
      const createdAtMs = Date.parse(parsed.createdAt);
      if (Number.isFinite(createdAtMs)) return Math.max(0, now - createdAtMs);
    }
  } catch {
    // Fall back to directory mtime if metadata is missing or malformed.
  }

  const stat = await fs.stat(lockPath);
  return Math.max(0, now - stat.mtimeMs);
}

async function pruneSeoManifestGenerations({
  activeGeneration,
  retainGenerations,
  tempStaleMs,
}: {
  activeGeneration: string;
  retainGenerations: number;
  tempStaleMs: number;
}) {
  const warnings: ShopSeoManifestWarning[] = [];
  const prunedGenerations: string[] = [];

  try {
    await pruneStaleTempGenerations(tempStaleMs, warnings);

    const generationNames = await readGenerationNames();
    const retained = new Set(generationNames.slice(0, retainGenerations));
    retained.add(activeGeneration);

    for (const generation of generationNames) {
      if (retained.has(generation)) continue;

      try {
        await fs.rm(getShopSeoManifestGenerationPath(generation), {
          recursive: true,
          force: true,
        });
        prunedGenerations.push(generation);
      } catch (error) {
        warnings.push({
          code: 'generation_prune_failed',
          message: `Failed to prune SEO manifest generation ${generation}: ${formatErrorMessage(
            error,
          )}`,
        });
      }
    }

    return {
      retainedGenerationCount: retained.size,
      prunedGenerations,
      warnings,
    };
  } catch (error) {
    return {
      retainedGenerationCount: 0,
      prunedGenerations,
      warnings: [
        ...warnings,
        {
          code: 'generation_prune_failed' as const,
          message: `Failed to inspect SEO manifest generations: ${formatErrorMessage(error)}`,
        },
      ],
    };
  }
}

async function pruneStaleTempGenerations(
  tempStaleMs: number,
  warnings: ShopSeoManifestWarning[],
) {
  const entries = await fs
    .readdir(getShopSeoManifestRoot(), { withFileTypes: true })
    .catch((error) => {
      if (isNodeErrorCode(error, 'ENOENT')) return [];
      throw error;
    });
  const now = Date.now();

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('.tmp-')) continue;

    const tempPath = path.join(getShopSeoManifestRoot(), entry.name);
    const stat = await fs.stat(tempPath).catch((error) => {
      warnings.push({
        code: 'temp_generation_prune_failed',
        message: `Failed to inspect stale SEO manifest temp directory ${entry.name}: ${formatErrorMessage(
          error,
        )}`,
      });
      return null;
    });
    if (!stat || now - stat.mtimeMs < tempStaleMs) continue;

    await fs.rm(tempPath, { recursive: true, force: true }).catch((error) => {
      warnings.push({
        code: 'temp_generation_prune_failed',
        message: `Failed to prune stale SEO manifest temp directory ${entry.name}: ${formatErrorMessage(
          error,
        )}`,
      });
    });
  }
}

async function readGenerationNames() {
  const entries = await fs.readdir(getShopSeoManifestGenerationsRoot(), {
    withFileTypes: true,
  }).catch((error) => {
    if (isNodeErrorCode(error, 'ENOENT')) return [];
    throw error;
  });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
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
      path.join(
        generationPath,
        'providers',
        SHOP_SEO_MANIFEST_PROVIDER_MERCHIZE,
        'products',
        'by-id',
      ),
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
  return `https://d2dytk4tvgwhb4.cloudfront.net/${image}`.replace(
    /\/thumb\.jpg(?:[?#].*)?$/i,
    '',
  );
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

function resolveRetainedGenerationCount(value: number | undefined) {
  const raw = value ?? Number(process.env.SHOP_SEO_MANIFEST_RETAIN_GENERATIONS ?? '');
  if (Number.isFinite(raw) && raw >= 1) return Math.floor(raw);
  return DEFAULT_RETAINED_SEO_MANIFEST_GENERATIONS;
}

function resolveGenerationLockStaleMs(value: number | undefined) {
  const rawSeconds =
    value === undefined
      ? Number(process.env.SHOP_SEO_MANIFEST_LOCK_STALE_SECONDS ?? '')
      : value / 1000;
  if (Number.isFinite(rawSeconds) && rawSeconds >= 30) return Math.floor(rawSeconds * 1000);
  return DEFAULT_GENERATION_LOCK_STALE_MS;
}

function isNodeErrorCode(error: unknown, code: string) {
  return (
    Boolean(error) &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}

function formatErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

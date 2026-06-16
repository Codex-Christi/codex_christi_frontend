// src/app/admin/shop/merchize-catalog-snapshots/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { merchizeCatalogPrisma } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';
import { refreshMerchizeCatalog } from '@/lib/merchizeCatalog/sync';
import { STOREFRONT_SNAPSHOT_CATEGORY_SLUGS } from '@/lib/merchizeStorefront/categories';
import {
  fetchCategoryProducts,
  getCategoryMetadataFromMerchize,
} from '@/app/shop/category/[id]/categoryDetailsSSR';
import { getCategoryPagePath } from '@/lib/utils/shop/categoryPagePath';

// const v = await merchizeCatalogPrisma.variant.findUnique({
//   where: { sku: 'FBJSVN000000AA02' },
//   select: {
//     sku: true,
//     tier1Price: true,
//     tier2Price: true,
//     tier3Price: true,
//     shippingBands: true,
//     tiersJson: true,
//   },
// });

// console.log('>>> Inspect variant FBJSVN000000AA02', v);

export async function getStorefrontSnapshotStats() {
  const [productCount, categoryCount, variantAgg, latestProduct, latestCategory] =
    await Promise.all([
      merchizeCatalogPrisma.storefrontProductSnapshot.count(),
      merchizeCatalogPrisma.storefrontCategorySnapshot.count(),
      merchizeCatalogPrisma.storefrontProductSnapshot.aggregate({
        _sum: { variantCount: true },
      }),
      merchizeCatalogPrisma.storefrontProductSnapshot.findFirst({
        orderBy: { lastSeenAt: 'desc' },
        select: { lastSeenAt: true },
      }),
      merchizeCatalogPrisma.storefrontCategorySnapshot.findFirst({
        orderBy: { lastSuccessfulFetchAt: 'desc' },
        select: { lastSuccessfulFetchAt: true },
      }),
    ]);

  return {
    productCount,
    categoryCount,
    variantSnapshotCount: variantAgg._sum.variantCount ?? 0,
    lastProductSnapshotAt: latestProduct?.lastSeenAt ?? null,
    lastCategorySnapshotAt: latestCategory?.lastSuccessfulFetchAt ?? null,
    ttlDays: process.env.MERCHIZE_STOREFRONT_SNAPSHOT_TTL_DAYS ?? '1',
  };
}

export async function refreshPriceShippingCatalogAction() {
  try {
    const result = await refreshMerchizeCatalog();

    const syncState = await merchizeCatalogPrisma.syncState.findUnique({
      where: { id: 'merchize_catalog' },
    });

    return {
      ok: true as const,
      ingestedVariants: result.ingestedVariants,
      totalProducts: result.totalProducts,
      syncState,
    };
  } catch (e: unknown) {
    console.error('[MerchizeCatalog] refreshPriceShippingCatalogAction error', e);
    const message = e instanceof Error ? e.message : 'Unknown error while refreshing catalog';
    return {
      ok: false as const,
      error: message,
    };
  }
}

export async function refreshStorefrontSnapshotsAction() {
  const pageSize = 50;
  const failures: Array<{ category: string; message: string }> = [];
  const categoryTotalPages = new Map<string, number>();
  const productIds = new Set<string>();
  let productsSeen = 0;
  let pagesFetched = 0;
  const refreshStartedAt = Date.now();

  console.info('[merchizeCatalogSnapshots.refreshStorefrontSnapshots] start', {
    categories: STOREFRONT_SNAPSHOT_CATEGORY_SLUGS.length,
    pageSize,
  });

  for (const [index, category] of STOREFRONT_SNAPSHOT_CATEGORY_SLUGS.entries()) {
    const categoryStartedAt = Date.now();
    let categoryProductsSeen = 0;
    let categoryPagesFetched = 0;

    console.info('[merchizeCatalogSnapshots.refreshStorefrontSnapshots] category:start', {
      category,
      categoryNumber: index + 1,
      totalCategories: STOREFRONT_SNAPSHOT_CATEGORY_SLUGS.length,
    });

    try {
      await getCategoryMetadataFromMerchize(category);
      const firstPage = await fetchCategoryProducts({
        category,
        page: 1,
        page_size: pageSize,
        forceSnapshotRefresh: true,
      });

      productsSeen += firstPage.products.length;
      categoryProductsSeen += firstPage.products.length;
      pagesFetched += 1;
      categoryPagesFetched += 1;
      categoryTotalPages.set(category, firstPage.totalPages);
      for (const product of firstPage.products) {
        if (product._id) productIds.add(product._id);
      }

      for (let page = 2; page <= firstPage.totalPages; page += 1) {
        const nextPage = await fetchCategoryProducts({
          category,
          page,
          page_size: pageSize,
          forceSnapshotRefresh: true,
        });
        productsSeen += nextPage.products.length;
        categoryProductsSeen += nextPage.products.length;
        pagesFetched += 1;
        categoryPagesFetched += 1;
        for (const product of nextPage.products) {
          if (product._id) productIds.add(product._id);
        }
      }

      console.info('[merchizeCatalogSnapshots.refreshStorefrontSnapshots] category:complete', {
        category,
        pagesFetched: categoryPagesFetched,
        productsSeen: categoryProductsSeen,
        totalPages: firstPage.totalPages,
        totalProducts: firstPage.count,
        elapsedMs: Date.now() - categoryStartedAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[merchizeCatalogSnapshots.refreshStorefrontSnapshots] category:failed', {
        category,
        message,
        elapsedMs: Date.now() - categoryStartedAt,
      });

      failures.push({
        category,
        message,
      });
    }
  }

  const stats = await getStorefrontSnapshotStats();
  const revalidatedPaths = revalidateStorefrontSnapshotPaths({
    categoryTotalPages,
    productIds,
  });
  const result = {
    ok: failures.length === 0,
    productsSeen,
    pagesFetched,
    categoriesAttempted: STOREFRONT_SNAPSHOT_CATEGORY_SLUGS.length,
    failures,
    stats,
    revalidatedPaths,
  };

  console.info('[merchizeCatalogSnapshots.refreshStorefrontSnapshots] complete', {
    ok: result.ok,
    categoriesAttempted: result.categoriesAttempted,
    pagesFetched: result.pagesFetched,
    productsSeen: result.productsSeen,
    failures: result.failures.map((failure) => failure.category),
    revalidatedPaths: result.revalidatedPaths.length,
    elapsedMs: Date.now() - refreshStartedAt,
  });

  return result;
}

function revalidateStorefrontSnapshotPaths({
  categoryTotalPages,
  productIds,
}: {
  categoryTotalPages: Map<string, number>;
  productIds: Set<string>;
}) {
  const paths = new Set<string>(['/shop']);

  for (const [category, totalPages] of categoryTotalPages) {
    const safeTotalPages = Math.max(1, totalPages);
    for (let page = 1; page <= safeTotalPages; page += 1) {
      paths.add(getCategoryPagePath(category, page));
    }
  }

  for (const productId of productIds) {
    paths.add(`/shop/product/${encodeURIComponent(productId)}`);
  }

  for (const path of paths) {
    revalidatePath(path);
  }

  return [...paths];
}

export async function searchPriceShippingCatalogBySku(query: string) {
  const q = query.trim();
  if (!q) {
    return { ok: false as const, message: 'Enter a SKU or partial SKU' };
  }

  try {
    const variants = await merchizeCatalogPrisma.variant.findMany({
      where: { sku: { contains: q } }, // Prisma SQLite StringFilter: no `mode`
      include: { product: true, shippingBands: true },
      take: 10,
    });

    return { ok: true as const, variants };
  } catch (e: unknown) {
    console.error('[MerchizeCatalog] searchPriceShippingCatalogBySku error', e);
    const message = e instanceof Error ? e.message : 'Unknown error while searching catalog';
    return { ok: false as const, message };
  }
}

'use server';

import {
  merchizeBaseURL,
  merchizeAPIKey,
  cacheForDays,
} from '../../product/[id]/productDetailsSSR';
import { cache } from 'react';
import {
  coerceMerchizeProviderError,
  fetchMerchizeJson,
  MerchizeProviderError,
} from '@/lib/merchizeStorefront/providerErrors';
import {
  getCategoryIdFromSnapshot,
  getCategoryMetadataSnapshotState,
  getCategoryProductsSnapshotState,
  upsertStorefrontCategoryPageSnapshot,
  upsertStorefrontCategorySnapshot,
} from '@/lib/merchizeStorefront/snapshot';
import type { BasicProductInterface } from '@/lib/merchizeStorefront/productTypes';
import {
  firstStringValue,
  toMerchizeProductPreviewUrl,
  toMerchizeThumbnailUrl,
} from '@/lib/merchizeStorefront/imageUrls';
import {
  canUseSavedListing,
  parseStorefrontCategoryMetadata,
  parseStorefrontCollections,
  parseStorefrontListing,
  STOREFRONT_LISTING_TIMEOUT_MS,
} from '@/lib/merchizeStorefront/listingPayload';

export type CategoryProductDetail = BasicProductInterface['data'];

type PaginationParams = {
  page: number;
  page_size: number;
  category: string;
  forceSnapshotRefresh?: boolean;
};

function normalizeCategoryProductImage(product: CategoryProductDetail): CategoryProductDetail {
  const galleryImage = firstStringValue((product as { gallery_uris?: unknown }).gallery_uris);
  const image = galleryImage
    ? toMerchizeThumbnailUrl(galleryImage)
    : toMerchizeProductPreviewUrl(product.image);

  return image ? { ...product, image } : product;
}

const getCategoryIDFromMerchize = cache(async (categoryName: string) => {
  const snapshotCategoryID = await getCategoryIdFromSnapshot(categoryName).catch((err) => {
    console.warn('[storefrontSnapshot] category id snapshot read failed:', err);
    return null;
  });
  if (snapshotCategoryID) return snapshotCategoryID;

  const collections = parseStorefrontCollections(
    await fetchFromMerchizeWithNextCache(
      `${merchizeBaseURL}/product/v2/collections/search`,
      'POST',
      new URLSearchParams({ name: `'${categoryName}'` }).toString().toLowerCase(),
      0.3,
      true,
    ),
  );
  const categoryID = collections[0]?._id;
  if (!categoryID) {
    throw new MerchizeProviderError({
      url: `${merchizeBaseURL}/product/v2/collections/search`,
      status: 404,
      message: `No Merchize category found for "${categoryName}"`,
    });
  }

  return categoryID;
});

export const getCategoryMetadataFromMerchize = cache(
  async (categoryName: string, forceRefresh = false) => {
    const snapshotState = await getCategoryMetadataSnapshotState(categoryName).catch((err) => {
      console.warn('[storefrontSnapshot] category metadata snapshot read failed:', err);
      return null;
    });
    if (!forceRefresh && snapshotState?.isFresh) return snapshotState.category;

    try {
      const categoryID = await getCategoryIDFromMerchize(categoryName);

      const metaDataObj = parseStorefrontCategoryMetadata(
        await fetchFromMerchizeWithNextCache(
          `${merchizeBaseURL}/product/v2/collections/${encodeURIComponent(categoryID)}`,
          'GET',
          null,
          forceRefresh ? 0 : 1,
        ),
      );

      const { description, name } = metaDataObj;

      const categoryMeta = {
        ...metaDataObj,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        description: description
          ? description.split('.')[0].replace(/<[^>]*>/g, '')
          : `Shop ${name} from Codex Christi.`,
        categoryID,
      };

      await upsertStorefrontCategorySnapshot({
        categorySlug: categoryName,
        merchizeCategoryId: categoryID,
        name: categoryMeta.name,
        description: categoryMeta.description,
        coverUrl: categoryMeta.cover?.url ?? null,
        rawCategoryJson: categoryMeta,
        force: forceRefresh,
      }).catch((err) => {
        if (forceRefresh) throw err;
        console.warn('[storefrontSnapshot] category snapshot upsert failed:', err);
      });

      return categoryMeta;
    } catch (err) {
      if (forceRefresh) throw err;
      if (canUseSavedListing(err)) {
        const snapshot = snapshotState?.category;
        if (snapshot) {
          console.info('[merchizeOfflineCatalog.categoryMetadata] snapshot:fallback', {
            category: categoryName,
            providerError: formatProviderErrorForLog(err),
          });
          return snapshot;
        }
      }

      throw err;
    }
  },
);

const fetchFromMerchizeWithNextCache = cache(
  async (
    url: string,
    method: string = 'GET',
    body: BodyInit | null | undefined = null,
    daysToCache?: number,
    isFormBody?: boolean,
  ) => {
    return fetchMerchizeJson(
      url,
      {
        method,
        headers: {
          'X-API-KEY': `${merchizeAPIKey}`,
          'Content-Type': isFormBody ? 'application/x-www-form-urlencoded' : 'application/json',
        },
        next: {
          revalidate: daysToCache === 0 ? 0 : daysToCache ? cacheForDays(daysToCache) : undefined,
        },

        body,
      },
      { timeoutMs: STOREFRONT_LISTING_TIMEOUT_MS },
    );
  },
);

export const fetchCategoryProducts = cache(async (params: PaginationParams) => {
  const { page, page_size, category, forceSnapshotRefresh } = params;
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(page_size) ||
    page_size < 1 ||
    page_size > 100
  ) {
    throw new RangeError('Category pagination is invalid.');
  }

  const snapshotState = !forceSnapshotRefresh
    ? await getCategoryProductsSnapshotState({ category, page, page_size }).catch((err) => {
        console.warn('[storefrontSnapshot] category products snapshot read failed:', err);
        return null;
      })
    : null;
  if (snapshotState?.isFresh) return snapshotState.products;

  try {
    const catID = await getCategoryIDFromMerchize(category);

    const {
      products,
      total,
      pages,
      page: currentPage,
    } = parseStorefrontListing(
      await fetchFromMerchizeWithNextCache(
        `${merchizeBaseURL}/product/products?limit=${page_size}&page=${page}&title=&collectionId[]=${encodeURIComponent(catID)}&minPrice=&maxPrice=`,
        'GET',
        null,
        forceSnapshotRefresh ? 0 : 0.3,
      ),
      page,
      page_size,
    );
    const normalizedProducts = products.map(normalizeCategoryProductImage);

    await upsertStorefrontCategoryPageSnapshot({
      categorySlug: category,
      merchizeCategoryId: catID,
      page: currentPage,
      pageSize: page_size,
      total,
      totalPages: pages,
      products: normalizedProducts,
      force: forceSnapshotRefresh,
    }).catch((err) => {
      if (forceSnapshotRefresh) throw err;
      console.warn('[storefrontSnapshot] category page snapshot upsert failed:', err);
    });

    return {
      next:
        pages > page
          ? `${merchizeBaseURL}/product/products?limit=${page_size}&page=${page + 1}&title=&collectionId[]=${catID}&minPrice=&maxPrice=`
          : null,
      previous:
        page > 1 && page <= pages
          ? `${merchizeBaseURL}/product/products?limit=${page_size}&page=${page - 1}&title=&collectionId[]=${catID}&minPrice=&maxPrice=`
          : null,
      current_page: currentPage,
      products: normalizedProducts,
      totalPages: pages,
      count: total,
    };
  } catch (err) {
    if (forceSnapshotRefresh) throw err;
    if (canUseSavedListing(err)) {
      const snapshot = snapshotState?.products;
      if (snapshot) {
        console.info('[merchizeOfflineCatalog.categoryProducts] snapshot:fallback', {
          category,
          page,
          pageSize: page_size,
          products: snapshot.products.length,
          totalPages: snapshot.totalPages,
          count: snapshot.count,
          providerError: formatProviderErrorForLog(err),
        });
        return snapshot;
      }
    }

    throw err;
  }
});

function formatProviderErrorForLog(error: unknown) {
  const providerError = coerceMerchizeProviderError(error);
  if (!providerError) {
    return {
      kind: 'unknown',
      status: null,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    kind: providerError.kind,
    status: providerError.status,
    message: providerError.message.slice(0, 140),
  };
}

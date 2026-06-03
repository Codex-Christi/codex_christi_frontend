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
  shouldUseStorefrontSnapshot,
} from '@/lib/merchizeStorefront/providerErrors';
import {
  getCategoryMetadataFromSnapshot,
  getCategoryProductsFromSnapshot,
  upsertStorefrontCategoryPageSnapshot,
  upsertStorefrontCategorySnapshot,
} from '@/lib/merchizeStorefront/snapshot';
import type { BasicProductInterface } from '@/lib/merchizeStorefront/productTypes';

type BasicProductData = BasicProductInterface['data'];

export type CategoryProductDetail = BasicProductData;

export type CategoryProductsResponse =
  | {
      success: boolean;
      data: {
        total: number;
        pages: number;
        page: number;
        next: null | string;
        previous: null | string;
        products: CategoryProductDetail[];
      };
    }
  | { success: false; message: string };

type PaginationParams = {
  page: number;
  page_size: number;
  category: string;
  forceSnapshotRefresh?: boolean;
};

// const baseURL = process.env.NEXT_PUBLIC_BASE_URL!;

type CategorySearchResponse = {
  data?: {
    collections?: Array<{ _id: string }>;
  };
};

// Get category's ID from Merchize
const getCategoryIDFromMerchize = async (categoryName: string) => {
  try {
    const res = (await fetchFromMerchizeWithNextCache({
      url: `${merchizeBaseURL}/product/v2/collections/search`,
      method: 'POST',
      body: new URLSearchParams({ name: `'${categoryName}'` }).toString().toLowerCase(),
      isFormBody: true,
      daysToCache: 0.3,
    })) as CategorySearchResponse;

    const categoryID = res.data?.collections?.[0]?._id;
    if (!categoryID) {
      throw new Error(`No Merchize category found for "${categoryName}"`);
    }

    return categoryID;
  } catch (err) {
    if (shouldUseStorefrontSnapshot(err)) {
      const snapshot = await getCategoryMetadataFromSnapshot(categoryName);
      if (snapshot?.categoryID) return snapshot.categoryID;
    }

    console.log(`Error while getting category ID from Merchize`, err);
    throw err;
  }
};

// Get tCategory's Metadata from Merchize
export const getCategoryMetadataFromMerchize = cache(async (categoryName: string) => {
  try {
    const categoryID = await getCategoryIDFromMerchize(categoryName);

    // Make second request to extract all metadata
    const { data: metaDataObj } = (await fetchFromMerchizeWithNextCache({
      url: `${merchizeBaseURL}/product/v2/collections/${categoryID}`,
      daysToCache: 1,
    })) as {
      data: { cover: { url: string } | null | undefined; description: string; name: string };
    };

    const { description, name } = metaDataObj || {};

    const categoryMeta = {
      ...metaDataObj,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      description: description
        ? description.split('.')[0].replace(/<[^>]*>/g, '')
        : `Buy ${name} now. Limited edition.`,
      categoryID,
    };

    await upsertStorefrontCategorySnapshot({
      categorySlug: categoryName,
      merchizeCategoryId: categoryID,
      name: categoryMeta.name,
      description: categoryMeta.description,
      coverUrl: categoryMeta.cover?.url ?? null,
      rawCategoryJson: categoryMeta,
    }).catch((err) => {
      console.warn('[storefrontSnapshot] category snapshot upsert failed:', err);
    });

    return categoryMeta;

    //  Catch errors
  } catch (err) {
    if (shouldUseStorefrontSnapshot(err)) {
      const snapshot = await getCategoryMetadataFromSnapshot(categoryName);
      if (snapshot) {
        console.info('[merchizeOfflineCatalog.categoryMetadata] snapshot:fallback', {
          category: categoryName,
          providerError: formatProviderErrorForLog(err),
        });
        return snapshot;
      }
    }

    console.log(err);
    throw err;
  }
});

// Fetch from Merchize with Next.js Cache
// This function is used to fetch data from Merchize API with caching enabled
const fetchFromMerchizeWithNextCache = cache(
  async (params: {
    url: string;
    body?: BodyInit | null | undefined;
    method?: string | undefined;
    daysToCache?: number;
    isFormBody?: boolean;
  }) => {
    // DEstrcuting params
    const { url, method, body, daysToCache, isFormBody } = params;

    // Main fetch from here
    return fetchMerchizeJson(url, {
      method: method ?? 'GET',
      headers: {
        'X-API-KEY': `${merchizeAPIKey}`,
        'Content-Type': isFormBody ? 'application/x-www-form-urlencoded' : 'application/json',
      },
      next: { revalidate: daysToCache ? cacheForDays(daysToCache) : undefined },

      body: body,
    });
  },
);

// Fetch products with caching and pagination
export const fetchCategoryProducts = cache(async (params: PaginationParams) => {
  const { page, page_size, category, forceSnapshotRefresh } = params;
  // const skip = (page - 1) * limit;

  try {
    // Get ID first
    const catID = await getCategoryIDFromMerchize(category);

    const categoryProductsResponse = (await fetchFromMerchizeWithNextCache(
      // `${baseURL}/product/filter-by-collection?collection=${category}&page=${page}&page_size=${page_size}`,

      {
        url: `${merchizeBaseURL}/product/products?limit=${page_size}&page=${page}&title=&collectionId[]=${catID}&minPrice=&maxPrice=`,
        daysToCache: 0.3,
      },
    )) as CategoryProductsResponse;

    if ('data' in categoryProductsResponse && categoryProductsResponse.success) {
      const { products, total, pages, page } = categoryProductsResponse.data;

      await upsertStorefrontCategoryPageSnapshot({
        categorySlug: category,
        merchizeCategoryId: catID,
        page,
        pageSize: page_size,
        total,
        totalPages: pages,
        products,
        force: forceSnapshotRefresh,
      }).catch((err) => {
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
        current_page: page,
        products,
        totalPages: pages,
        count: total,
      };
    } else {
      // Handle error case
      throw new Error(
        'message' in categoryProductsResponse && categoryProductsResponse.success === false
          ? categoryProductsResponse.message
          : 'Unknown error fetching category products',
      );
    }
  } catch (err) {
    if (shouldUseStorefrontSnapshot(err)) {
      const snapshot = await getCategoryProductsFromSnapshot({ category, page, page_size });
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

    console.error(err);

    throw err;
  }
});

// Server action for revalidation
export async function revalidateProducts(category: string) {
  // This would normally be an API call to your revalidation endpoint
  console.log(`Revalidating products-${category}`);

  // In production:
  // await fetch(`/api/revalidate?tag=products-${category}`);
}

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

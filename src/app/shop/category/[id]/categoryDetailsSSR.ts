'use server';

import {
  merchizeBaseURL,
  merchizeAPIKey,
  cacheForDays,
  BasicProductInterface,
} from '../../product/[id]/productDetailsSSR';
import { cache } from 'react';

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
};

const baseURL = process.env.NEXT_PUBLIC_BASE_URL!;

// Get category's ID from Merchize
const getCategoryIDFromMerchize = async (categoryName: string) => {
  try {
    const res = await fetchFromMerchizeWithNextCache({
      url: `${merchizeBaseURL}/product/v2/collections/search`,
      method: 'POST',
      body: new URLSearchParams({ name: `'${categoryName}'` }).toString().toLowerCase(),
      isFormBody: true,
      daysToCache: 3,
    });

    const categoryID = res!.data!.collections[0]._id as string;

    return categoryID;
  } catch (err) {
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

    return {
      ...metaDataObj,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      description: description
        ? description.split('.')[0].replace(/<[^>]*>/g, '')
        : `Buy ${name} now. Limited edition.`,
      categoryID,
    };

    //  Catch errors
  } catch (err) {
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
    daysToCache: number;
    isFormBody?: boolean;
  }) => {
    // DEstrcuting params
    const { url, method, body, daysToCache, isFormBody } = params;

    // Main fetch from here
    try {
      return await fetch(`${url}`, {
        method: method ?? 'GET',
        headers: {
          'X-API-KEY': `${merchizeAPIKey}`,
          'Content-Type': isFormBody ? 'application/x-www-form-urlencoded' : 'application/json',
        },
        next: { revalidate: cacheForDays(daysToCache) || undefined },

        body: body,
      })
        .then(async (resp) => {
          if (!resp.ok) {
            throw new Error('Network error');
          }

          const data = await resp.json();
          return data;
        })
        .catch((err) => {
          console.log(err);
        });
    } catch (err) {
      console.log(err);

      throw err;
    }
  },
);

// Fetch products with caching and pagination
export const fetchCategoryProducts = cache(async (params: PaginationParams) => {
  const { page, page_size, category } = params;
  // const skip = (page - 1) * limit;

  // Get ID first
  const catID = await getCategoryIDFromMerchize(category);

  try {
    const categoryProductsResponse: CategoryProductsResponse = await fetchFromMerchizeWithNextCache(
      // `${baseURL}/product/filter-by-collection?collection=${category}&page=${page}&page_size=${page_size}`,

      {
        url: `${merchizeBaseURL}/product/products?limit=${page_size}&page=${page}&title=&collectionId[]=${catID}&minPrice=&maxPrice=`,
        daysToCache: 0.3,
      },
    );

    if ('data' in categoryProductsResponse && categoryProductsResponse.success) {
      const { products, total, pages, page } = categoryProductsResponse.data;
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

import 'server-only';
import {
  merchizeBaseURL,
  merchizeAPIKey,
  cacheForDays,
  BasicProductInterface,
} from '../../product/[id]/productDetailsSSR';
import { cache } from 'react';

interface CategoryProductDetail extends Omit<BasicProductInterface['data'], '_id'> {
  external_product_id: string;
}

export type CategoryProductsResponse =
  | {
      success: boolean;
      data: {
        count: number;
        total_pages: number;
        current_page: number | number;
        next: null | string;
        previous: null | string;
        results: CategoryProductDetail[];
      };
    }
  | {
      errors: {
        type: string;
        code: string;
        message: string;
        field_name: null | string;
      }[];
    };

type PaginationParams = {
  page: number;
  page_size: number;
  category: string;
};

const baseURL = process.env.NEXT_PUBLIC_BASE_URL!;

export const getCategoryMetadataFromMerchize = cache(async (categoryName: string) => {
  try {
    const res = await fetchFromMerchizeWithNextCache({
      url: `${merchizeBaseURL}/product/v2/collections/search`,
      method: 'POST',
      body: new URLSearchParams({ name: `'${categoryName}'` }).toString(),
      isFormBody: true,
      daysToCache: 1,
    });

    const categoryID = res.data.collections[0]._id as string;

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
    return await fetch(`${url}`, {
      method: method ?? 'GET',
      headers: {
        'X-API-KEY': `${merchizeAPIKey}`,
        'Content-Type': isFormBody ? 'application/x-www-form-urlencoded' : 'application/json',
      },
      next: { revalidate: cacheForDays(daysToCache) },

      body: body,
    }).then(async (resp) => {
      if (!resp.ok) throw new Error('Network error');

      const data = await resp.json();
      return data;
    });
  },
);

// Fetch products with caching and pagination
export const fetchCategoryProducts = cache(async (params: PaginationParams) => {
  const { page, page_size, category } = params;
  // const skip = (page - 1) * limit;
  try {
    const categoryProductsResponse = await fetch(
      `${baseURL}/product/filter-by-collection?collection=${category}&page=${page}&page_size=${page_size}`,
      { next: { tags: [`products-${category}`], revalidate: cacheForDays(1) } },
    ).then(async (resp) => {
      if (!resp.ok) {
        throw new Error(`HTTP error! Status: ${resp.status}, Status Text: ${resp.statusText}`);
      }
      return resp.json().then((data: CategoryProductsResponse) => data);
    });
    if ('data' in categoryProductsResponse && categoryProductsResponse.success) {
      const { results, count, total_pages, current_page, next, previous } =
        categoryProductsResponse.data;
      return {
        next,
        previous,
        current_page,
        products: results,
        totalPages: total_pages,
        count,
      };
    } else {
      // Handle error case
      throw new Error(
        Array.isArray(
          (
            categoryProductsResponse as {
              errors: { type: string; code: string; message: string; field_name: null | string }[];
            }
          ).errors,
        )
          ? (
              categoryProductsResponse as {
                errors: {
                  type: string;
                  code: string;
                  message: string;
                  field_name: null | string;
                }[];
              }
            ).errors
              .map((e) => e.message)
              .join(', ')
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

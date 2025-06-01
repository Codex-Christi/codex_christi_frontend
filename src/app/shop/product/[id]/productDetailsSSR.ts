// utils/getProductDetailsSSR.ts
import { cache } from 'react';
import { notFound } from 'next/navigation';
import axios from 'axios';

// ENV
const merchizeToken = process.env.MERCHIZE_TOKEN!;
const baseURL = process.env.NEXT_PUBLIC_BASE_URL!;
const merchizeBaseURL = process.env.MERCHIZE_BASE_URL!;

// Interfaces
interface BasicProductInterface {
  data: { _id: string; title: string; description: string; image: string };
}
interface ProductVariantsInterface {
  data: {
    _id: string;
    image_uris: string[];
    retail_price: number;
    is_default: boolean;
    title: string;
  }[];
}
interface ProductResult {
  productMetaData: BasicProductInterface['data'];
  productVariants: ProductVariantsInterface['data'];
}

// Axios client
const axiosClient = axios.create({
  baseURL: `${baseURL}`,
});

// Main SSR function
export const getProductDetailsSSR = cache(
  async (productID: string): Promise<ProductResult> => {
    try {
      // 1. get external product
      const ExternalID = await axiosClient
        .get<{
          data: { external_product_id: string };
        }>(`/product/${productID}/filter-by-id`)
        .then((res) => {
          if (res.status !== 200) {
            console.error(
              `[getProductDetailsSSR] External product fetch failed: ${res.statusText}`
            );
            return notFound();
          }
          const externalProductData = res.data.data;
          return externalProductData.external_product_id;
        })
        .catch((error) => {
          console.error(
            `[getProductDetailsSSR] External product fetch error: ${error}`
          );
          return notFound();
        });

      // 2. Fetch base product info
      const productRes = await fetchAndCacheFromMerchize(
        `/product/products/${ExternalID}`,
        7 // Cache for 7 days
      );
      if (!productRes.ok) {
        console.error(
          `[getProductDetailsSSR] Product fetch failed: ${productRes.statusText}`
        );
        return notFound();
      }
      const productData: BasicProductInterface = await productRes.json();
      const { _id, description, title, image } = productData.data;

      // 3. Fetch variants from Merchize
      const variantsRes = await fetchAndCacheFromMerchize(
        `/product/products/${_id}/variants`,
        7 // Cache for 7 days
      );
      if (!variantsRes.ok) {
        console.error(
          `[getProductDetailsSSR] Variant fetch failed: ${variantsRes.statusText}`
        );
        return notFound();
      }
      const variantData: ProductVariantsInterface = await variantsRes.json();

      //   Return the combined data
      return {
        productMetaData: { _id, description, title, image },
        productVariants: variantData.data,
      };
    } catch (error) {
      console.error('[getProductDetailsSSR] Unexpected Error', error);
      return notFound();
    }
  }
);

const cacheForDays = (days: number) => {
  return 60 * 60 * 24 * days;
};

const fetchAndCacheFromMerchize = async (url: string, cacheDays: number) => {
  return await fetch(`${merchizeBaseURL}${url}`, {
    headers: {
      Authorization: `Bearer ${merchizeToken}`,
    },
    next: { revalidate: cacheForDays(cacheDays) }, // You can configure this independently
  });
};

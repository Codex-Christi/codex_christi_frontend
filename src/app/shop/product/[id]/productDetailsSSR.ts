// utils/getProductDetailsSSR.ts
import { cache } from 'react';

const merchizeToken: string = process.env.MERCHIZE_TOKEN!;
const baseURL: string = process.env.NEXT_PUBLIC_BASE_URL!;
const merchizeBaseURL: string = process.env.MERCHIZE_BASE_URL!;

// Interfaces
export interface BasicProductInterface {
  data: { _id: string; title: string; description: string; image: string };
}
type ProductAttribute = {
  is_preselected: boolean;
  position: 0;
  hide_storefront: false;
};
type ClothingSizeSlug = 'xs' | 's' | 'm' | 'l' | 'xl' | '2xl' | '3xl' | '4xl';
type ClothingSizeValue = 'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL' | '3XL' | '4XL';
type SizeAttribute = {
  slug: ClothingSizeSlug;
  value: ClothingSizeValue;
  name: ClothingSizeValue;
  attribute: {
    name: 'Size';
    value_type: 'size';
  };
};
type ColorAttribute = {
  slug: string;
  value: string;
  name: string;
  attribute: {
    name: 'Color';
    value_type: 'color';
  };
};
// All possible attributes
type VariantAttribute = ProductAttribute | SizeAttribute | ColorAttribute;

// This enforces that SizeAttribute must be present
type ProductVariantOptions = [SizeAttribute, ...VariantAttribute[]];

// Product Variants Interface
export interface ProductVariantsInterface {
  data: {
    _id: string;
    image_uris: string[];
    retail_price: number;
    is_default: boolean;
    title: string;
    options: ProductVariantOptions;
  }[];
}
export interface ProductResult {
  productMetaData: BasicProductInterface['data'];
  productVariants: ProductVariantsInterface['data'];
}

// Utility function to cache for a specific number of days
const cacheForDays = (days: number): number => 60 * 60 * 24 * days;

// 1. Fetch External ID
export const fetchExternalProductID = cache(
  async (
    productID: string
  ): Promise<{ external_product_id: string; image: string }> => {
    const res: Response = await fetch(
      `${baseURL}/product/${productID}/filter-by-id`,
      {
        next: { revalidate: cacheForDays(7) },
      }
    );

    if (!res.ok) {
      const error: string = `[fetchExternalProductID] Failed: ${res.statusText}`;
      console.error(error);
      throw new Error(error);
    }

    const { data } = await res.json();
    const { external_product_id, image } = data;
    return { external_product_id, image };
  }
);

// 2. Fetch Base Product Info
export const fetchBaseProduct = cache(
  async (
    externalProductID: string,
    image: string
  ): Promise<BasicProductInterface['data']> => {
    const res: Response = await fetch(
      `${merchizeBaseURL}/product/products/${externalProductID}`,
      {
        headers: {
          Authorization: `Bearer ${merchizeToken}`,
        },
        next: { revalidate: cacheForDays(7) },
      }
    );

    if (!res.ok) {
      const error: string = `[fetchBaseProduct] Failed: ${res.statusText}`;
      console.error(error);
      throw new Error(error);
    }

    const json: BasicProductInterface = await res.json();
    const { _id, title, description } = json.data;
    return { _id, title, description, image };
  }
);

// 3. Fetch Product Variants
export const fetchProductVariants = cache(
  async (productID: string): Promise<ProductVariantsInterface['data']> => {
    const res: Response = await fetch(
      `${merchizeBaseURL}/product/products/${productID}/all-variants`,
      {
        headers: {
          Authorization: `Bearer ${merchizeToken}`,
        },
        next: { revalidate: cacheForDays(7) },
      }
    );

    if (!res.ok) {
      const error: string = `[fetchProductVariants] Failed: ${res.statusText}`;
      console.error(error);
      throw new Error(error);
    }

    const json: ProductVariantsInterface = await res.json();
    return json.data;
  }
);

// Combined Function: All Three Steps
export const getProductDetailsSSR = cache(
  async (productID: string): Promise<ProductResult> => {
    const { external_product_id, image } =
      await fetchExternalProductID(productID);
    const productMetaData: BasicProductInterface['data'] =
      await fetchBaseProduct(external_product_id, image);
    const productVariants: ProductVariantsInterface['data'] =
      await fetchProductVariants(productMetaData._id);

    return { productMetaData, productVariants };
  }
);

// Combined Function: External ID and Base Product Info Only
export const getProductMetaDataOnly = cache(
  async (productID: string): Promise<BasicProductInterface['data']> => {
    const { external_product_id, image } =
      await fetchExternalProductID(productID);
    const productMetaData: BasicProductInterface['data'] =
      await fetchBaseProduct(external_product_id, image);

    return productMetaData;
  }
);

// utils/getProductDetailsSSR.ts
import { cache } from 'react';

// --- Env Config ---
const merchizeToken = process.env.MERCHIZE_TOKEN!;
const baseURL = process.env.NEXT_PUBLIC_BASE_URL!;
const merchizeBaseURL = process.env.MERCHIZE_BASE_URL!;
const merchizeAPIKey = process.env.MERRCHIZE_API_KEY!;

const cacheForDays = (days: number): number => 60 * 60 * 24 * days;

// --- In-Memory Memoization Maps ---
const externalProductIDMemo = new Map<
  string,
  Promise<{ external_product_id: string; image: string; slug: string }>
>();
const baseProductMemo = new Map<
  string,
  Promise<BasicProductInterface['data']>
>();
const productVariantsMemo = new Map<
  string,
  Promise<ProductVariantsInterface['data']>
>();

// --- Interfaces ---
export interface BasicProductInterface {
  data: {
    _id: string;
    title: string;
    description: string;
    image: string;
    retail_price: string;
    slug: string;
  };
}

// --- Attribute Types ---
// Base type for attributes to ensure consistency

type AttributeBase<Name extends string, ValueType extends string> = {
  slug: string;
  value: string;
  name: string;
  attribute: {
    name: Name;
    value_type: ValueType;
  };
};

export type ProductAttribute = AttributeBase<'Product', 'slide'> & {
  is_preselected: boolean;
  position: 0;
  hide_storefront: false;
};

type ClothingSizeSlug =
  | 'xs'
  | 's'
  | 'm'
  | 'l'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl'
  | '5xl';
export type ClothingSizeValue = Uppercase<ClothingSizeSlug>;

export type SizeAttribute = {
  slug: ClothingSizeSlug;
  value: ClothingSizeValue;
  name: ClothingSizeValue;
  attribute: {
    name: 'Size';
    value_type: 'size';
  };
};

export type ColorAttribute = {
  slug?: string;
  value: string; // could be hex or named
  name: string;
  attribute?: {
    name: 'Color';
    value_type: 'color';
  };
};

// Supported combinations based on required SizeAttribute and optional Color/ProductAttribute
export type ProductVariantOptions =
  | [SizeAttribute]
  | [SizeAttribute, ColorAttribute]
  | [SizeAttribute, ProductAttribute]
  | [ProductAttribute, SizeAttribute, ColorAttribute];

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

// Utility: Check if a product variant has both Color and Size attributes
export function hasColorAndSize(options: ProductVariantOptions): boolean {
  const hasColor = options.some(
    (opt) => opt.attribute && opt.attribute.name === 'Color'
  );
  const hasSize = options.some(
    (opt) => opt.attribute && opt.attribute.name === 'Size'
  );
  return hasColor && hasSize;
}

export interface ProductResult {
  productMetaData: BasicProductInterface['data'];
  productVariants: ProductVariantsInterface['data'];
}

function isValidUUID(uuid: string) {
  const regex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  return regex.test(uuid);
}

// --- Fetch External ID with dual memoization ---
export const fetchExternalProductID = cache((productIDorSlug: string) => {
  if (externalProductIDMemo.has(productIDorSlug)) {
    return externalProductIDMemo.get(productIDorSlug)!;
  }

  const isUUID = isValidUUID(productIDorSlug);

  const idOrSlugEndpoint = isUUID
    ? `${baseURL}/product/${productIDorSlug}/filter-by-id`
    : ` ${baseURL}/product/filter-by-slug/${productIDorSlug}`;

  const promise = (async () => {
    const res = await fetch(idOrSlugEndpoint, {
      next: { revalidate: cacheForDays(7) },
    });

    if (!res.ok) {
      const error = `[fetchExternalProductID] Failed: ${res.statusText}`;
      console.error(error);
      throw new Error(error);
    }

    const { data } = await res.json();
    return {
      external_product_id: data.external_product_id,
      image: data.image,
      slug: data.slug,
    };
  })();

  externalProductIDMemo.set(productIDorSlug, promise);
  return promise;
});

// --- Fetch Base Product Info ---
export const fetchBaseProduct = cache(
  (externalProductID: string, image: string, slug: string) => {
    const key = `${externalProductID}|${image}`;
    if (baseProductMemo.has(key)) {
      return baseProductMemo.get(key)!;
    }

    const promise = (async () => {
      const res = await fetch(
        `${merchizeBaseURL}/product/products/${externalProductID}`,
        {
          headers: {
            'X-API-KEY': `${merchizeAPIKey}`,
            // Authorization: `Bearer ${merchizeToken}`,
          },
          next: { revalidate: cacheForDays(7) },
        }
      );

      if (!res.ok) {
        const error = `[fetchBaseProduct] Failed: ${res.statusText}`;
        console.error(error);
        throw new Error(error);
      }

      const json: BasicProductInterface = await res.json();
      return { ...json.data, image, slug };
    })();

    baseProductMemo.set(key, promise);
    return promise;
  }
);

// --- Fetch Variants Info ---
export const fetchProductVariants = cache((productIDorSlug: string) => {
  if (productVariantsMemo.has(productIDorSlug)) {
    return productVariantsMemo.get(productIDorSlug)!;
  }

  const promise = (async () => {
    const res = await fetch(
      `${merchizeBaseURL}/product/products/${productIDorSlug}/all-variants`,
      {
        headers: { Authorization: `Bearer ${merchizeToken}` },
        next: { revalidate: cacheForDays(7) },
      }
    );

    if (!res.ok) {
      const error = `[fetchProductVariants] Failed: ${res.statusText}`;
      console.error(error);
      throw new Error(error);
    }

    const json: ProductVariantsInterface = await res.json();

    const variantsData = json.data;
    // Example: log for the first variant if present
    if (variantsData.length > 0) {
      if (hasColorAndSize(json.data[0].options)) {
        // CHECK FOR OPTION ABNORMALITIES AND RETRANSFORM
        return variantsData.map((variant) => {
          const options = variant.options;
          if (options[1]?.attribute?.value_type === 'color') {
            // This is when color comes before size
            // Returns the retransformed array of options

            const retransformed_options = [
              options[0],
              options[2],
              options[1],
            ].filter(Boolean) as ProductVariantOptions;

            return { ...variant, options: retransformed_options };
          } else {
            return {
              ...variant,
              options: variant.options as ProductVariantOptions,
            };
          }
        });
      } else {
        return variantsData;
      }
    }

    return variantsData;
  })();

  productVariantsMemo.set(productIDorSlug, promise);
  return promise;
});

// --- Combined Full Fetch ---
export const getProductDetailsSSR = cache(
  async (productIDorSlug: string): Promise<ProductResult> => {
    const { external_product_id, image, slug } =
      await fetchExternalProductID(productIDorSlug);
    const productMetaData = await fetchBaseProduct(
      external_product_id,
      image,
      slug
    );
    const productVariants = await fetchProductVariants(productMetaData._id);

    return { productMetaData, productVariants };
  }
);

// --- Metadata-Only Fetch ---
export const getProductMetaDataOnly = cache(
  async (productIDorSlug: string): Promise<BasicProductInterface['data']> => {
    const { external_product_id, image, slug } =
      await fetchExternalProductID(productIDorSlug);
    return fetchBaseProduct(external_product_id, image, slug);
  }
);

// utils/getProductDetailsSSR.ts
import { cache } from 'react';

// --- Env Config ---
// const merchizeToken = process.env.MERCHIZE_TOKEN!;
export const merchizeBaseURL = process.env.MERCHIZE_BASE_URL!;
export const merchizeAPIKey = process.env.MERCHIZE_API_KEY!;

export const cacheForDays = (days: number): number => 60 * 60 * 24 * days;

// --- In-Memory Memoization Maps ---
const baseProductMemo = new Map<string, Promise<BasicProductInterface['data']>>();
const productVariantsMemo = new Map<string, Promise<ProductVariantsInterface['data']>>();

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
  slug?: string;
  value: string;
  name: string;
  attribute?: {
    name: Name;
    value_type: ValueType;
  };
};

// canonical value_type literals used across variants
type VariantValueType = 'size' | 'color' | 'product' | 'label';

export type ProductAttribute = AttributeBase<'Product', VariantValueType> & {
  is_preselected?: boolean;
  position?: number;
  hide_storefront?: boolean;
};

type ClothingSizeSlug = 'xs' | 's' | 'm' | 'l' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
export type ClothingSizeValue = Uppercase<ClothingSizeSlug>;

// Required size attribute shape
type AttrRequired<Name extends string, ValueType extends string, Value = string, Slug = string> = {
  slug: Slug;
  value: Value;
  name: Value;
  attribute: { name: Name; value_type: ValueType };
};

type AttrOptionalAttr<Name extends string, ValueType extends string, Value = string> = {
  slug?: string;
  value: Value;
  name: Value;
  attribute?: { name: Name; value_type: ValueType };
};

export type SizeAttribute = AttrRequired<'Size', 'size', ClothingSizeValue, ClothingSizeSlug>;
export type ColorAttribute = AttrOptionalAttr<'Color', 'color', string>;
export type LabelAttribute = AttrOptionalAttr<'label', 'label', string>;

// Supported combinations based on required SizeAttribute and optional Color/ProductAttribute
export type ProductOption = SizeAttribute | ColorAttribute | ProductAttribute | LabelAttribute;

/**
 * Flexible variant options:
 * - Must contain at least one option (enforced by tuple type)
 * - Order is not fixed; normalization helpers will canonicalize ordering when needed
 */
export type ProductVariantOptions = [ProductOption, ...ProductOption[]];

export interface ProductVariantsInterface {
  data: {
    _id: string;
    image_uris: string[];
    retail_price: number;
    is_default: boolean;
    title: string;
    options: ProductVariantOptions;
    sku: string;
    product: string;
  }[];
}

// Utility: Check if a product variant has both Color and Size attributes
export function hasColorAndSize(options: ProductVariantOptions): boolean {
  const hasColor = options.some(
    (opt) =>
      !!opt.attribute &&
      typeof opt.attribute.name === 'string' &&
      opt.attribute.name.toLowerCase() === 'color',
  );
  const hasSize = options.some(
    (opt) =>
      !!opt.attribute &&
      typeof opt.attribute.name === 'string' &&
      opt.attribute.name.toLowerCase() === 'size',
  );
  return hasColor && hasSize;
}

export interface ProductResult {
  productMetaData: BasicProductInterface['data'];
  productVariants: ProductVariantsInterface['data'];
}

// --- Fetch Base Product Info ---
export const fetchBaseProduct = cache((externalProductID: string) => {
  const key = `${externalProductID}`;
  if (baseProductMemo.has(key)) {
    return baseProductMemo.get(key)!;
  }

  const promise = (async () => {
    const res = await fetch(`${merchizeBaseURL}/product/products/${externalProductID}`, {
      headers: {
        'X-API-KEY': `${merchizeAPIKey}`,
        // Authorization: `Bearer ${merchizeToken}`,
      },
      next: { revalidate: cacheForDays(7) },
    });

    if (!res.ok) {
      const error = `[fetchBaseProduct] Failed: ${res.statusText}`;
      console.error(error);
      throw new Error(error);
    }

    const json: BasicProductInterface = await res.json();

    return { ...json.data };
  })();

  baseProductMemo.set(key, promise);
  return promise;
});

// --- Fetch Variants Info ---

export const fetchProductVariants = cache((productIDorSlug: string) => {
  if (productVariantsMemo.has(productIDorSlug)) {
    return productVariantsMemo.get(productIDorSlug)!;
  }

  const promise = (async () => {
    const res = await fetch(`${merchizeBaseURL}/product/products/${productIDorSlug}/all-variants`, {
      headers: { 'X-API-KEY': `${merchizeAPIKey}` },
      next: { revalidate: cacheForDays(7) },
    });

    if (!res.ok) {
      const error = `[fetchProductVariants] Failed: ${res.statusText}`;
      console.error(error);
      throw new Error(error);
    }

    const json: ProductVariantsInterface = await res.json();

    const variantsData = json.data;
    // Normalize options ordering and attributes for each variant
    // if (variantsData.length > 0) {
    //   return variantsData.map((variant) => {
    //     const rawOptions = variant.options || ([] as ProductOption[]);

    //     // Normalize each option first
    //     const normalized = rawOptions.map((o) => normalizeOption(o as ProductOption));

    //     // Find canonical size and color (if present)
    //     const sizeIdx = normalized.findIndex(
    //       (o) => o.attribute && o.attribute.value_type === 'size',
    //     );
    //     const colorIdx = normalized.findIndex(
    //       (o) => o.attribute && o.attribute.value_type === 'color',
    //     );

    //     const others = normalized.filter(
    //       (_, idx) => idx !== sizeIdx && idx !== colorIdx,
    //     ) as ProductOption[];

    //     const ordered: ProductOption[] = [];
    //     if (sizeIdx !== -1) ordered.push(normalized[sizeIdx]);
    //     if (colorIdx !== -1) ordered.push(normalized[colorIdx]);
    //     ordered.push(...others);

    //     // Ensure we return a ProductVariantOptions tuple type when possible:
    //     const finalOptions = ordered as unknown as ProductVariantOptions;

    //     return {
    //       ...variant,
    //       options: finalOptions,
    //     };
    //   });
    // }

    return variantsData;
  })();

  productVariantsMemo.set(productIDorSlug, promise);

  return promise;
});

// --- Combined Full Fetch ---
export const getProductDetailsSSR = cache(
  async (productIDorSlug: string): Promise<ProductResult> => {
    const [productMetaData, productVariants] = await Promise.all([
      fetchBaseProduct(productIDorSlug),
      fetchProductVariants(productIDorSlug),
    ]);

    return { productMetaData, productVariants };
  },
);

// --- Metadata-Only Fetch ---
export const getProductMetaDataOnly = cache(
  async (productIDorSlug: string): Promise<BasicProductInterface['data']> => {
    // const { external_product_id, image, slug } = await fetchExternalProductID(productIDorSlug);
    return fetchBaseProduct(productIDorSlug);
  },
);

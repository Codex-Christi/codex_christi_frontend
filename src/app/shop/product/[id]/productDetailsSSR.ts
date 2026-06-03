// utils/getProductDetailsSSR.ts
import { cache } from 'react';
import {
  fetchMerchizeJson,
  shouldUseStorefrontSnapshot,
} from '@/lib/merchizeStorefront/providerErrors';
import {
  getBasicProductSnapshotState,
  getProductDetailsFromSnapshot,
  getProductVariantsSnapshotState,
  upsertStorefrontProductSnapshot,
  upsertStorefrontProductVariantsSnapshot,
} from '@/lib/merchizeStorefront/snapshot';
import type {
  BasicProductInterface,
  ProductResult,
  ProductVariantsInterface,
} from '@/lib/merchizeStorefront/productTypes';

// --- Env Config ---
// const merchizeToken = process.env.MERCHIZE_TOKEN!;
export const merchizeBaseURL = process.env.MERCHIZE_BASE_URL!;
export const merchizeAPIKey = process.env.MERCHIZE_API_KEY!;

export const cacheForDays = (days: number): number => 60 * 60 * 24 * days;
export const storefrontSnapshotCacheSeconds = () => {
  const days = Number(process.env.MERCHIZE_STOREFRONT_SNAPSHOT_TTL_DAYS ?? '1');
  if (!Number.isFinite(days) || days < 0) return cacheForDays(1);
  return Math.max(0, Math.floor(cacheForDays(days)));
};

// --- Fetch Base Product Info ---
export const fetchBaseProduct = cache((externalProductID: string) => {
  return (async () => {
    const snapshot = await getBasicProductSnapshotState(externalProductID);
    if (snapshot?.isFresh) {
      return snapshot.product;
    }

    try {
      const json = await fetchMerchizeJson<BasicProductInterface>(
        `${merchizeBaseURL}/product/products/${externalProductID}`,
        {
          headers: {
            'X-API-KEY': `${merchizeAPIKey}`,
            // Authorization: `Bearer ${merchizeToken}`,
          },
          next: { revalidate: storefrontSnapshotCacheSeconds() },
        },
      );

      await upsertStorefrontProductSnapshot(json.data).catch((err) => {
        console.warn('[storefrontSnapshot] product snapshot upsert failed:', err);
      });

      return { ...json.data };
    } catch (err) {
      if (!shouldUseStorefrontSnapshot(err)) throw err;

      if (!snapshot) throw err;
      return snapshot.product;
    }
  })();
});

// --- Fetch Variants Info ---

export const fetchProductVariants = cache((productIDorSlug: string) => {
  return (async () => {
    const snapshot = await getProductVariantsSnapshotState(productIDorSlug);
    if (snapshot?.isFresh) {
      return snapshot.variants;
    }

    let variantsData: ProductVariantsInterface['data'];
    try {
      const json = await fetchMerchizeJson<ProductVariantsInterface>(
        `${merchizeBaseURL}/product/products/${productIDorSlug}/all-variants`,
        {
          headers: { 'X-API-KEY': `${merchizeAPIKey}` },
          next: { revalidate: storefrontSnapshotCacheSeconds() },
        },
      );

      variantsData = json.data;
      await upsertStorefrontProductVariantsSnapshot(productIDorSlug, variantsData).catch((err) => {
        console.warn('[storefrontSnapshot] variants snapshot upsert failed:', err);
      });
    } catch (err) {
      if (!shouldUseStorefrontSnapshot(err)) throw err;

      if (!snapshot) throw err;
      variantsData = snapshot.variants;
    }
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
});

// --- Combined Full Fetch ---
export const getProductDetailsSSR = cache(
  async (productIDorSlug: string): Promise<ProductResult> => {
    try {
      const [productMetaData, productVariants] = await Promise.all([
        fetchBaseProduct(productIDorSlug),
        fetchProductVariants(productIDorSlug),
      ]);

      return { productMetaData, productVariants };
    } catch (err) {
      if (!shouldUseStorefrontSnapshot(err)) throw err;

      const snapshot = await getProductDetailsFromSnapshot(productIDorSlug);
      if (!snapshot) throw err;
      return snapshot;
    }
  },
);

// --- Metadata-Only Fetch ---
export const getProductMetaDataOnly = cache(
  async (productIDorSlug: string): Promise<BasicProductInterface['data']> => {
    // const { external_product_id, image, slug } = await fetchExternalProductID(productIDorSlug);
    return fetchBaseProduct(productIDorSlug);
  },
);

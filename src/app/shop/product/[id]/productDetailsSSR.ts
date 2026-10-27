// utils/getProductDetailsSSR.ts
import { cache } from 'react';
import {
  fetchMerchizeJson,
  shouldUseStorefrontSnapshot,
} from '@/lib/merchizeStorefront/providerErrors';
import {
  assertBasicStorefrontProductData,
  getBasicProductSnapshotState,
  getProductDetailsFromSnapshot,
  isInvalidStorefrontProductPayloadError,
  upsertStorefrontProductSnapshot,
} from '@/lib/merchizeStorefront/snapshot';
import type { BasicProductInterface, ProductResult } from '@/lib/merchizeStorefront/productTypes';
import { resolveProviderStorefrontProductCompatibility } from '@/lib/merchizeStorefront/currentProductLineCompatibility';

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
export const fetchBaseProduct = cache((externalProductID: string, forceRefresh = false) => {
  return (async () => {
    const snapshot = await getBasicProductSnapshotState(externalProductID).catch((err) => {
      console.warn('[storefrontSnapshot] product snapshot read failed:', err);
      return null;
    });
    if (!forceRefresh && snapshot?.isFresh) {
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
          ...(forceRefresh
            ? { cache: 'no-store' as const }
            : { next: { revalidate: storefrontSnapshotCacheSeconds() } }),
        },
      );

      const product = assertBasicStorefrontProductData(
        json.data,
        `Merchize product ${externalProductID}`,
      );

      await upsertStorefrontProductSnapshot(product, { force: forceRefresh }).catch((err) => {
        if (forceRefresh) throw err;
        console.warn('[storefrontSnapshot] product snapshot upsert failed:', err);
      });

      return { ...product };
    } catch (err) {
      if (forceRefresh) throw err;
      if (!shouldUseStorefrontSnapshot(err) && !isInvalidStorefrontProductPayloadError(err)) {
        throw err;
      }

      if (!snapshot) throw err;
      return snapshot.product;
    }
  })();
});

const fetchLiveProductVariantCompatibility = cache((productIDorSlug: string) =>
  resolveProviderStorefrontProductCompatibility(productIDorSlug, { persist: true }),
);

export const fetchCurrentProductVariantCompatibility = cache(async (productIDorSlug: string) => {
  const providerProduct = await fetchLiveProductVariantCompatibility(productIDorSlug);
  return providerProduct.compatibility;
});

export const fetchSellableProductVariants = cache(async (productIDorSlug: string) => {
  const compatibility = await fetchCurrentProductVariantCompatibility(productIDorSlug);
  return compatibility.sellableVariants;
});

// --- Combined Full Fetch ---
export const getProductDetailsSSR = cache(
  async (productIDorSlug: string): Promise<ProductResult> => {
    try {
      const providerProduct = await fetchLiveProductVariantCompatibility(productIDorSlug);
      return {
        productMetaData: providerProduct.productMetaData,
        productVariants: providerProduct.compatibility.sellableVariants,
      };
    } catch (err) {
      if (!shouldUseStorefrontSnapshot(err) && !isInvalidStorefrontProductPayloadError(err)) {
        throw err;
      }

      const snapshot = await getProductDetailsFromSnapshot(productIDorSlug);
      if (!snapshot) throw err;
      // Snapshot data may keep the page understandable during a provider outage, but it is display
      // metadata only. It never provides positive current availability evidence.
      return {
        ...snapshot,
        productVariants: [],
      };
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

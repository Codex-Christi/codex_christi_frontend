import { cache } from 'react';
import {
  fetchMerchizeJson,
  shouldUseStorefrontSnapshot,
  coerceMerchizeProviderError,
  MerchizeProviderError,
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
import { STRICT_STOREFRONT_PROVIDER_TIMEOUT_MS } from '@/lib/merchizeStorefront/strictLiveProduct';
import { resolveProductGalleryImages } from '@/lib/merchizeStorefront/imageUrls';
import {
  getStorefrontPublication,
  isStorefrontProductUnpublished,
} from '@/lib/merchizeStorefront/publication';

export const merchizeBaseURL = process.env.MERCHIZE_BASE_URL!;
export const merchizeAPIKey = process.env.MERCHIZE_API_KEY!;

export const cacheForDays = (days: number): number => 60 * 60 * 24 * days;
export const storefrontSnapshotCacheSeconds = () => {
  const days = Number(process.env.MERCHIZE_STOREFRONT_SNAPSHOT_TTL_DAYS ?? '1');
  if (!Number.isFinite(days) || days < 0) return cacheForDays(1);
  return Math.max(0, Math.floor(cacheForDays(days)));
};

function assertPublicDisplayProduct(product: BasicProductInterface['data']) {
  if (isStorefrontProductUnpublished(product))
    throw new MerchizeProviderError({
      url: `${merchizeBaseURL}/product/products/${encodeURIComponent(product._id)}`,
      status: 404,
      message: 'This storefront product is not published.',
    });
  return product;
}

// --- Fetch Base Product Info ---
export const fetchBaseProduct = cache(async (externalProductID: string, forceRefresh = false) => {
  const snapshot = await getBasicProductSnapshotState(externalProductID).catch((err) => {
    console.warn('[storefrontSnapshot] product snapshot read failed:', err);
    return null;
  });
  if (!forceRefresh && snapshot?.isFresh) {
    return assertPublicDisplayProduct(snapshot.product);
  }

  let liveProduct: BasicProductInterface['data'] | null = null;
  try {
    const json = await fetchMerchizeJson<BasicProductInterface>(
      `${merchizeBaseURL}/product/products/${externalProductID}`,
      {
        headers: {
          'X-API-KEY': `${merchizeAPIKey}`,
        },
        ...(forceRefresh
          ? { cache: 'no-store' as const }
          : { next: { revalidate: storefrontSnapshotCacheSeconds() } }),
      },
      { timeoutMs: STRICT_STOREFRONT_PROVIDER_TIMEOUT_MS },
    );

    const product = assertBasicStorefrontProductData(
      json.data,
      `Merchize product ${externalProductID}`,
    );
    liveProduct = product;

    await upsertStorefrontProductSnapshot(product, { force: forceRefresh }).catch((err) => {
      if (forceRefresh) throw err;
      console.warn('[storefrontSnapshot] product snapshot upsert failed:', err);
    });
    assertPublicDisplayProduct(product);
    if (
      getStorefrontPublication(product) === 'unknown' &&
      snapshot &&
      isStorefrontProductUnpublished(snapshot.product)
    ) {
      assertPublicDisplayProduct(snapshot.product);
    }

    return {
      ...product,
      image:
        resolveProductGalleryImages({
          metadata: product,
          fallbackImageUrl: snapshot?.product.image,
        })[0] ?? '',
    };
  } catch (err) {
    if (
      !liveProduct &&
      coerceMerchizeProviderError(err)?.kind === 'not_found' &&
      snapshot &&
      !isStorefrontProductUnpublished(snapshot.product)
    ) {
      await upsertStorefrontProductSnapshot(
        { ...snapshot.product, _storefront_not_found: true },
        { force: true },
      ).catch(() => console.warn('[storefrontSnapshot] product removal could not be saved'));
    }
    if (forceRefresh) throw err;
    if (!shouldUseStorefrontSnapshot(err) && !isInvalidStorefrontProductPayloadError(err)) {
      throw err;
    }

    if (!snapshot) throw err;
    return assertPublicDisplayProduct(snapshot.product);
  }
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

export const getProductMetaDataOnly: (
  productIDorSlug: string,
) => Promise<BasicProductInterface['data']> = fetchBaseProduct;

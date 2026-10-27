'use client';
import { ProductResult, ProductVariantsInterface } from '@/lib/merchizeStorefront/productTypes';
import { createContext, useContext, FC, ReactNode, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useCurrencyCookie } from '@/lib/utils/shop/globalFXProductPrice/currencyCookieStore';
import type { ProductUnavailabilityReason } from '@/lib/merchizeStorefront/destinationAvailability';
import type { ProductOptionLayoutGroup } from '@/lib/merchizeStorefront/productOptionLayout';

const ProductTitleAndSizesEtc = dynamic(() => import('./ProductTitleAndSizesEtc'));

export interface ProductDetailsProps {
  // Define any props if needed
  productId: string;
  fetchedProductData: ProductResult;
  initialImageUrls: string[];
  descriptionSection?: ReactNode;
  children?: ReactNode;
  optionLayoutHints?: ProductOptionLayoutGroup[];
}

export interface OptionalProductVariantProps {
  variants: Partial<ProductDetailsProps['fetchedProductData']['productVariants']>;
  productMetaData?: { title: string; slug: string };
  isLoadingVariants?: boolean;
}

type VariantLoadState = 'loading' | 'ready' | 'error';
const EMPTY_VARIANTS: ProductVariantsInterface['data'] = [];
const EMPTY_OPTION_LAYOUT: ProductOptionLayoutGroup[] = [];
type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

// Use ProductResult directly as the context type
export type ProductDetailsContextValue = ProductResult & {
  productId: string;
  initialImageUrls: string[];
  variantLoadState: VariantLoadState;
  variantLoadError: string | null;
  retryVariants: () => void;
  deliveryCountry: string;
  deliveryCountryName: string;
  unavailabilityReason: ProductUnavailabilityReason;
  optionLayoutHints: ProductOptionLayoutGroup[];
};

export const ProductDetailsContext = createContext<ProductDetailsContextValue | undefined>(
  undefined,
);

export const useProductDetailsContext = () => {
  const context = useContext(ProductDetailsContext);
  if (!context) {
    throw new Error('useProductDetailsContext must be used within ProductDetailsProvider');
  }
  return context;
};

export const ProductDetailsProvider: FC<ProductDetailsProps> = ({
  productId,
  fetchedProductData,
  initialImageUrls,
  children,
  optionLayoutHints = EMPTY_OPTION_LAYOUT,
}) => {
  const country = useCurrencyCookie((state) => state.iso3) || 'USA';
  const requestKey = `${productId}:${country}`;
  const [response, setResponse] = useState<{
    key: string;
    variants: ProductVariantsInterface['data'];
    state: VariantLoadState;
    error: string | null;
    countryName: string;
    reason: ProductUnavailabilityReason;
  } | null>(null);
  const currentResponse = response?.key === requestKey ? response : null;
  const productVariants = currentResponse?.variants ?? EMPTY_VARIANTS;
  const variantLoadState = currentResponse?.state ?? 'loading';
  const variantLoadError = currentResponse?.error ?? null;
  const deliveryCountryName = currentResponse?.countryName ?? country;
  const unavailabilityReason = currentResponse?.reason ?? null;
  const [retrySequence, setRetrySequence] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof window.setTimeout> | null = null;
    let idleId: number | null = null;
    const controller = new AbortController();
    const idleWindow = window as IdleWindow;

    const loadVariants = async (attempt = 0) => {
      setResponse({
        key: requestKey,
        variants: EMPTY_VARIANTS,
        state: 'loading',
        error: null,
        countryName: country,
        reason: null,
      });
      let retryable = true;

      try {
        const res = await fetch(
          `/next-api/shop/products/${encodeURIComponent(productId)}/variants?country=${encodeURIComponent(country)}`,
          {
            credentials: 'same-origin',
            signal: controller.signal,
          },
        );
        const json = (await res.json()) as {
          data?: ProductVariantsInterface['data'];
          error?: string;
          verificationIncomplete?: boolean;
          countryName?: string;
          unavailabilityReason?: ProductUnavailabilityReason;
        };

        if (!res.ok || !Array.isArray(json.data)) {
          retryable = res.status === 429 || res.status >= 500;
          throw new Error(json.error || 'Unable to load product options.');
        }

        if (json.verificationIncomplete && json.data.length === 0) {
          throw new Error('Product availability could not be verified. Please try again.');
        }

        if (cancelled) return;

        setResponse({
          key: requestKey,
          variants: json.data,
          state: 'ready',
          error: null,
          countryName: json.countryName ?? country,
          reason: json.unavailabilityReason ?? null,
        });
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;

        if (retryable && attempt < 1) {
          timeoutId = globalThis.setTimeout(() => void loadVariants(attempt + 1), 5_000);
          return;
        }

        setResponse({
          key: requestKey,
          variants: EMPTY_VARIANTS,
          state: 'error',
          error: err instanceof Error ? err.message : 'Unable to load product options.',
          countryName: country,
          reason: 'verification_unavailable',
        });
      }
    };

    const scheduleLoad = () => {
      void loadVariants();
    };

    if (idleWindow.requestIdleCallback) {
      idleId = idleWindow.requestIdleCallback(scheduleLoad, { timeout: 900 });
    } else {
      timeoutId = globalThis.setTimeout(scheduleLoad, 120);
    }

    return () => {
      cancelled = true;
      controller.abort();
      if (idleId !== null) idleWindow.cancelIdleCallback?.(idleId);
      if (timeoutId !== null) globalThis.clearTimeout(timeoutId);
    };
  }, [productId, country, requestKey, retrySequence]);

  const contextValue = useMemo<ProductDetailsContextValue>(
    () => ({
      productId,
      initialImageUrls,
      productMetaData: fetchedProductData.productMetaData,
      productVariants,
      variantLoadState,
      variantLoadError,
      retryVariants: () => setRetrySequence((sequence) => sequence + 1),
      deliveryCountry: country,
      deliveryCountryName,
      unavailabilityReason,
      optionLayoutHints,
    }),
    [
      fetchedProductData.productMetaData,
      initialImageUrls,
      productId,
      productVariants,
      variantLoadError,
      variantLoadState,
      country,
      deliveryCountryName,
      unavailabilityReason,
      optionLayoutHints,
    ],
  );

  return (
    <ProductDetailsContext.Provider value={contextValue}>
      {children ?? <ProductTitleAndSizesEtc />}
    </ProductDetailsContext.Provider>
  );
};

export const ProductPurchasePanelContent = () => <ProductTitleAndSizesEtc />;

const ProductDetails: FC<ProductDetailsProps> = (props) => {
  return (
    <ProductDetailsProvider {...props}>
      <ProductPurchasePanelContent />
    </ProductDetailsProvider>
  );
};

export default ProductDetails;

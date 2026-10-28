'use client';

import { useCallback, useEffect, useState } from 'react';
import { useCurrencyCookie } from '@/lib/utils/shop/globalFXProductPrice/currencyCookieStore';
import {
  fetchProductOptions,
  ProductOptionsError,
  type ProductOptionsResponse,
} from '@/lib/merchizeStorefront/productOptions';
import type { ProductVariantsInterface } from '@/lib/merchizeStorefront/productTypes';

const EMPTY_VARIANTS: ProductVariantsInterface['data'] = [];
type OptionsState = {
  key: string;
  data?: ProductOptionsResponse;
  error?: Error;
};

export function useProductVariants(productId: string, shouldFetch: boolean) {
  const country = useCurrencyCookie((state) => state.iso3) || 'USA';
  const [retrySequence, setRetrySequence] = useState(0);
  const [response, setResponse] = useState<OptionsState | null>(null);
  const requestKey = `${productId}:${country}:${retrySequence}`;
  const enabled = shouldFetch && Boolean(productId);
  // Never expose a previous country's options, even before the next effect runs.
  const current = enabled && response?.key === requestKey ? response : null;
  const retry = useCallback(() => setRetrySequence((sequence) => sequence + 1), []);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let retryTimeoutId: ReturnType<typeof setTimeout> | undefined;

    async function load(attempt = 0) {
      try {
        const data = await fetchProductOptions(productId, country, controller.signal);
        if (!controller.signal.aborted) setResponse({ key: requestKey, data });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (attempt === 0 && (!(error instanceof ProductOptionsError) || error.retryable)) {
          retryTimeoutId = setTimeout(() => void load(1), 5_000);
          return;
        }
        setResponse({
          key: requestKey,
          error: error instanceof Error ? error : new Error('Unable to load product options.'),
        });
      }
    }

    void load();
    return () => {
      controller.abort();
      if (retryTimeoutId !== undefined) clearTimeout(retryTimeoutId);
    };
  }, [enabled, productId, country, requestKey]);

  return {
    data: current?.data,
    error: current?.error,
    isLoading: enabled && !current,
    variants: current?.data?.data ?? EMPTY_VARIANTS,
    country,
    countryName: current?.data?.countryName ?? country,
    unavailabilityReason: current?.data?.unavailabilityReason ?? null,
    retry,
  };
}

'use client';

import useSWRImmutable from 'swr/immutable';
import {
  fetcher,
  FetcherError,
} from '@/components/UI/Shop/Categories/[eachCategory]/CategoryListProductCard/fetcher';
import { ProductVariantsInterface } from '@/app/shop/product/[id]/productDetailsSSR';

export const useProductVariants = (productId: string, shouldFetch: boolean) => {
  // Use a unique key for SWR that is part of the API route URL
  const key = shouldFetch && productId ? `/next-api/shop/products/${productId}/variants` : null;

  return useSWRImmutable<ProductVariantsInterface, FetcherError>(key, fetcher);
};

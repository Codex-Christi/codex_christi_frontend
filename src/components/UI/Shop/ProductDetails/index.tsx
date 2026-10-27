'use client';
import type { ProductResult } from '@/lib/merchizeStorefront/productTypes';
import { createContext, useContext, FC, ReactNode, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useProductVariants } from '@/lib/hooks/shopHooks/products/variants/useProductVariants';
import type { ProductUnavailabilityReason } from '@/lib/merchizeStorefront/destinationAvailability';
import type { ProductOptionLayoutGroup } from '@/lib/merchizeStorefront/productOptionLayout';

const ProductTitleAndSizesEtc = dynamic(() => import('./ProductTitleAndSizesEtc'));

export interface ProductDetailsProps {
  productId: string;
  fetchedProductData: ProductResult;
  initialImageUrls: string[];
  descriptionSection?: ReactNode;
  children?: ReactNode;
  optionLayoutHints?: ProductOptionLayoutGroup[];
}

type VariantLoadState = 'loading' | 'ready' | 'error';
const EMPTY_OPTION_LAYOUT: ProductOptionLayoutGroup[] = [];

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
  const {
    variants: productVariants,
    isLoading,
    error,
    country,
    countryName: deliveryCountryName,
    unavailabilityReason,
    retry: retryVariants,
  } = useProductVariants(productId, true, { defer: true });
  const variantLoadState: VariantLoadState = isLoading ? 'loading' : error ? 'error' : 'ready';
  const variantLoadError = error?.message ?? null;

  const contextValue = useMemo<ProductDetailsContextValue>(
    () => ({
      productId,
      initialImageUrls,
      productMetaData: fetchedProductData.productMetaData,
      productVariants,
      variantLoadState,
      variantLoadError,
      retryVariants,
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
      retryVariants,
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

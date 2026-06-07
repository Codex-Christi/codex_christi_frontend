'use client';
import { ProductResult } from '@/lib/merchizeStorefront/productTypes';
import ProductSummary from './ProductSummary';
import { createContext, useContext, FC, ReactNode, useMemo } from 'react';

export interface ProductDetailsProps {
  // Define any props if needed
  fetchedProductData: ProductResult;
  descriptionSection: ReactNode;
}

export interface OptionalProductVariantProps {
  variants: Partial<ProductDetailsProps['fetchedProductData']['productVariants']>;
  productMetaData?: { title: string; slug: string };
}

// Use ProductResult directly as the context type
export const ProductDetailsContext = createContext<ProductResult | undefined>(undefined);

export const useProductDetailsContext = () => {
  const context = useContext(ProductDetailsContext);
  if (!context) {
    throw new Error('useProductDetailsContext must be used within ProductDetailsProvider');
  }
  return context;
};

const ProductDetails: FC<ProductDetailsProps> = ({ fetchedProductData, descriptionSection }) => {
  //   JSX
  return (
    // Main JSX
    <ProductDetailsContext.Provider value={useMemo(() => fetchedProductData, [fetchedProductData])}>
      <div className='grid gap-8 items-start px-2 py-12 md:px-[20px] lg:px-[24px] lg:grid-cols-6 xl:grid-cols-3'>
        <ProductSummary descriptionSection={descriptionSection} />
      </div>
    </ProductDetailsContext.Provider>
  );
};

export default ProductDetails;

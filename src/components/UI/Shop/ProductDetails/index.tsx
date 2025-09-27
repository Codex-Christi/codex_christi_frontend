'use client';
import { ProductResult } from '@/app/shop/product/[id]/productDetailsSSR';
import dynamic from 'next/dynamic';
const ProductSummary = dynamic(() => import('./ProductSummary'));
const ProductTitleAndSizesEtc = dynamic(() => import('./ProductTitleAndSizesEtc'));
import Link from 'next/link';
import { createContext, useContext, FC, useMemo } from 'react';
import { useResponsiveSSRValue } from '@/lib/hooks/useResponsiveSSR_Store';

export interface ProductDetailsProps {
  // Define any props if needed
  fetchedProductData: ProductResult;
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

const ProductDetails: FC<ProductDetailsProps> = ({ fetchedProductData }) => {
  // Hooks
  const { isDesktopOnly } = useResponsiveSSRValue();

  //   JSX
  return (
    // Main JSX
    <ProductDetailsContext.Provider value={useMemo(() => fetchedProductData, [fetchedProductData])}>
      <div className='grid gap-8 items-start px-2 py-12 md:px-[20px] lg:px-[24px] lg:grid-cols-6 xl:grid-cols-3'>
        <ProductSummary />
        {isDesktopOnly && <ProductTitleAndSizesEtc />}
      </div>
      <div className='space-y-8 mt-4 lg:col-span-2'>
        <div className='grid place-content-center gap-4'>
          <p>Please tell us what you think.</p>

          <Link
            className='text-center bg-[#0085FF] px-4 py-3 rounded-lg text-white'
            href='/shop/contact-us/'
          >
            Kindly give us a feedback!
          </Link>
        </div>
      </div>
    </ProductDetailsContext.Provider>
  );
};

export default ProductDetails;

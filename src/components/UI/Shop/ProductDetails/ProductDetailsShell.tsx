import type { ReactNode } from 'react';
import type { ProductResult } from '@/lib/merchizeStorefront/productTypes';
import { ProductDetailsProvider, ProductPurchasePanelContent } from '.';
import { ProductImageGallery } from './ProductImageGallery';
import type { ProductOptionLayoutGroup } from '@/lib/merchizeStorefront/productOptionLayout';

type ProductDetailsShellProps = {
  productId: string;
  fetchedProductData: ProductResult;
  initialImageUrls: string[];
  descriptionSection: ReactNode;
  optionLayoutHints: ProductOptionLayoutGroup[];
};

export default function ProductDetailsShell({
  productId,
  fetchedProductData,
  initialImageUrls,
  descriptionSection,
  optionLayoutHints,
}: ProductDetailsShellProps) {
  return (
    <main className='grid min-w-0 gap-8 items-start px-2 py-12 md:px-[20px] lg:px-[24px] lg:grid-cols-6 xl:grid-cols-3'>
      <ProductDetailsProvider
        key={productId}
        productId={productId}
        fetchedProductData={fetchedProductData}
        initialImageUrls={initialImageUrls}
        optionLayoutHints={optionLayoutHints}
      >
        <div className='grid min-w-0 gap-4 lg:col-span-4 xl:col-span-2'>
          <ProductImageGallery
            productMetaData={fetchedProductData.productMetaData}
            initialImageUrls={initialImageUrls}
          />
        </div>

        <ProductPurchasePanelContent />
      </ProductDetailsProvider>

      <div className='min-w-0 lg:col-span-4 xl:col-span-2'>{descriptionSection}</div>
    </main>
  );
}

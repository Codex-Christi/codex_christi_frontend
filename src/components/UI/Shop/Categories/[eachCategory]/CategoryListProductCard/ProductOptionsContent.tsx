'use client';

import { useMemo, type ReactNode } from 'react';
import { AddToCart } from '../../../ProductDetails/AddToCart';
import { BuyNow } from '../../../ProductDetails/BuyNow';
import VariantAttributeSelector from '../../../ProductDetails/VariantAttributeSelector';
import { getProductOptionGroups } from '@/lib/merchizeStorefront/productOptionLayout';
import { useProductVariants } from '@/lib/hooks/shopHooks/products/variants/useProductVariants';

interface ProductOptionsContentProps {
  productId: string;
  productTitle: string;
  productSlug: string;
  loading: ReactNode;
}

export default function ProductOptionsContent({
  productId,
  productTitle,
  productSlug,
  loading,
}: ProductOptionsContentProps) {
  const { data, error, isLoading } = useProductVariants(productId, true);
  const optionGroups = useMemo(
    () => Array.isArray(data?.data) ? getProductOptionGroups(data.data) : [],
    [data],
  );

  return (
    <>
      {isLoading && loading}
      {error && (
        <div className='text-red-400'>
          <p className='font-semibold'>Error: {error.message}</p>
        </div>
      )}
      {data && (
        <>
          {optionGroups.map((group) => (
            <VariantAttributeSelector key={group.attribute} {...group} />
          ))}
          <div className='space-y-4'>
            <AddToCart
              variants={data.data}
              productMetaData={{ title: productTitle, slug: productSlug }}
            />
            <BuyNow />
          </div>
        </>
      )}
    </>
  );
}

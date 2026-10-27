'use client';

import { useMemo, type ReactNode } from 'react';
import { ProductPurchaseActions } from '../../../ProductDetails/ProductPurchaseActions';
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
  const { data, variants, error, isLoading, countryName, unavailabilityReason, retry } =
    useProductVariants(productId, true);
  const optionGroups = useMemo(() => getProductOptionGroups(variants), [variants]);

  return (
    <>
      {isLoading && loading}
      {error && (
        <div role='status' className='space-y-2 text-sm text-white/80'>
          <p>Options are temporarily unavailable. Please try again.</p>
          <button type='button' className='underline underline-offset-4' onClick={retry}>
            Try again
          </button>
        </div>
      )}
      {data && (
        <>
          {!variants.length && (
            <p role='status' className='text-sm text-white/80'>
              {unavailabilityReason === 'shipping_unavailable'
                ? `This product isn't available for delivery to ${countryName}.`
                : 'This product is currently unavailable.'}
            </p>
          )}
          {data.verificationIncomplete && (
            <p role='status' className='text-sm text-white/80'>
              Some options could not be verified. Only verified options are shown.
            </p>
          )}
          {optionGroups.map((group) => (
            <VariantAttributeSelector key={group.attribute} {...group} />
          ))}
          <div className='space-y-4'>
            <ProductPurchaseActions
              productId={productId}
              variants={variants}
              productMetaData={{ title: productTitle, slug: productSlug }}
            />
          </div>
        </>
      )}
    </>
  );
}

import dynamic from 'next/dynamic';
import { useProductDetailsContext } from '.';
import { useCurrentVariant } from './currentVariantStore';
import { Suspense, useMemo } from 'react';
import { PriceSkeleton } from '../GlobalShopComponents/GlobalProductPrice';
import { Skeleton } from '../../primitives/skeleton';
import styles from './ProductDetails.module.css';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import { getProductOptionGroups } from '@/lib/merchizeStorefront/productOptionLayout';
import VariantAttributeSelector, { VariantAttributeSkeleton } from './VariantAttributeSelector';

const ProductPurchaseActions = dynamic(() =>
  import('./ProductPurchaseActions').then((mod) => mod.ProductPurchaseActions),
);
const DeliveryandPaymentsBanner = dynamic(() =>
  import('./DeliveryandPaymentsBanner').then((mod) => mod.DeliveryandPaymentsBanner),
);
const DeliveryCountryDropdown = dynamic(() => import('../Index/CountryDropDownClientFloating'));
const GlobalProductPrice = dynamic(() =>
  import('../GlobalShopComponents/GlobalProductPrice').then((mod) => mod.default),
);

const ProductTitleAndSizesEtc = () => {
  const productDetailsContext = useProductDetailsContext();
  const matchingVariant = useCurrentVariant((state) => state.matchingVariant);
  const metadata = productDetailsContext.productMetaData;
  const variantsAreLoading = productDetailsContext.variantLoadState === 'loading';
  const variantsFailed = productDetailsContext.variantLoadState === 'error';

  const title = metadata.title;
  const retailPrice = matchingVariant ? matchingVariant.retail_price : metadata.retail_price;
  const optionGroups = useMemo(
    () => getProductOptionGroups(productDetailsContext.productVariants),
    [productDetailsContext.productVariants],
  );

  return (
    <div className='grid min-w-0 gap-4 lg:col-span-2 xl:col-span-1'>
      <div className={`${styles.productPanel} ${styles.spaceLarge} min-w-0`}>
        <div className='space-y-3'>
          <h2 className='font-bold text-2xl'>{title}</h2>

          <div className='flex items-start gap-2'>
            <div className='space-y-3 cursor-pointer'>
              <h3 className={styles.priceHeading}>
                <Suspense fallback={<PriceSkeleton className='h-5 w-24' />}>
                  <GlobalProductPrice usdAmount={Number(retailPrice)} />
                </Suspense>
              </h3>
            </div>
          </div>
        </div>

        {/* Size, Color and Label Selectors */}
        <div className={styles.optionLayoutRegion} aria-busy={variantsAreLoading}>
          <div
            className={`${styles.optionLayoutSizer} ${styles.spaceLarge} ${variantsAreLoading ? '' : styles.hiddenOptionSizer}`}
            aria-hidden='true'
            inert
          >
            {productDetailsContext.optionLayoutHints.length > 0 ? (
              productDetailsContext.optionLayoutHints.map((group) => (
                <VariantAttributeSkeleton key={group.attribute} {...group} />
              ))
            ) : (
              <div className='space-y-3'>
                <Skeleton className='h-5 w-28 bg-white/15' />
                <div className='grid grid-cols-4 gap-2'>
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className='h-10 bg-white/10' />
                  ))}
                </div>
              </div>
            )}
          </div>
          <span className='sr-only' role='status'>
            {variantsAreLoading ? 'Loading product options' : ''}
          </span>
          <div className={`${styles.optionLayoutContent} ${styles.spaceLarge}`}>
            {variantsAreLoading ? null : variantsFailed ? (
              <div
                role='status'
                className='rounded-lg border border-white/10 bg-black/30 p-3 text-sm text-white/80'
              >
                <p>Options are temporarily unavailable. Please try again shortly.</p>
                <button
                  type='button'
                  onClick={productDetailsContext.retryVariants}
                  className='mt-2 underline underline-offset-4'
                >
                  Try again
                </button>
              </div>
            ) : productDetailsContext.productVariants.length === 0 ? (
              <div className='rounded-lg border border-white/10 p-3 text-sm text-white/80'>
                <p>
                  {productDetailsContext.unavailabilityReason === 'shipping_unavailable'
                    ? `Unfortunately, this product isn't available for delivery to ${productDetailsContext.deliveryCountryName}.`
                    : 'This product is currently unavailable.'}
                </p>
                {productDetailsContext.unavailabilityReason === 'shipping_unavailable' && (
                  <fieldset className='mt-3 min-w-0'>
                    <legend className='text-sm'>Delivery country</legend>
                    <DeliveryCountryDropdown
                      initialIso3={productDetailsContext.deliveryCountry}
                      wrapperClassName='mt-2'
                      classNames={{
                        trigger:
                          'inline-flex min-h-10 max-w-full items-center gap-2 rounded-md border border-white/20 bg-black/40 px-3 text-white',
                      }}
                    />
                  </fieldset>
                )}
                <CustomShopLink
                  href='/shop'
                  className='mt-2 inline-block underline underline-offset-4'
                >
                  Browse other products
                </CustomShopLink>
              </div>
            ) : (
              optionGroups.map((group) => (
                <VariantAttributeSelector key={group.attribute} {...group} />
              ))
            )}
          </div>
        </div>

        {/* Add to Cart and Buy Now buttons */}
        <div className={`${styles.purchaseActions} space-y-4`}>
          <ProductPurchaseActions
            productId={productDetailsContext.productId}
            variants={productDetailsContext.productVariants}
            productMetaData={metadata}
            isLoadingVariants={variantsAreLoading}
          />
        </div>
      </div>

      <DeliveryandPaymentsBanner />
    </div>
  );
};

export default ProductTitleAndSizesEtc;

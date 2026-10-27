import dynamic from 'next/dynamic';
import { useProductDetailsContext } from '.';
import { useCurrentVariant } from './currentVariantStore';
import { Suspense, useMemo } from 'react';
import { PriceSkeleton } from '../GlobalShopComponents/GlobalProductPrice';
import { Skeleton } from '../../primitives/skeleton';
import {
  SizeAttribute,
  ColorAttribute,
  ProductVariantOptions,
} from '@/lib/merchizeStorefront/productTypes';
import styles from './ProductDetails.module.css';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import { getProductAttributeOptions } from '@/lib/merchizeStorefront/productOptionLayout';
import VariantAttributeSelector, { VariantAttributeSkeleton } from './VariantAttributeSelector';

const AddToCart = dynamic(() => import('./AddToCart').then((mod) => mod.AddToCart));
const BuyNow = dynamic(() => import('./BuyNow').then((mod) => mod.BuyNow));
const DeliveryandPaymentsBanner = dynamic(() =>
  import('./DeliveryandPaymentsBanner').then((mod) => mod.DeliveryandPaymentsBanner),
);
const DeliveryCountryDropdown = dynamic(() => import('../Index/CountryDropDownClientFloating'));
const GlobalProductPrice = dynamic(() =>
  import('../GlobalShopComponents/GlobalProductPrice').then((mod) => mod.default),
);

// Main Component
const ProductTitleAndSizesEtc = () => {
  // Hooks
  const productDetailsContext = useProductDetailsContext();
  const matchingVariant = useCurrentVariant((state) => state.matchingVariant);
  const metadata = productDetailsContext.productMetaData;
  const variantsAreLoading = productDetailsContext.variantLoadState === 'loading';
  const variantsFailed = productDetailsContext.variantLoadState === 'error';

  const { title, retail_price } = useMemo(() => {
    if (!matchingVariant) {
      return {
        title: metadata.title,
        retail_price: metadata.retail_price,
      };
    } else {
      return {
        title: metadata.title,
        retail_price: matchingVariant?.retail_price,
      };
    }
  }, [matchingVariant, metadata.retail_price, metadata.title]);

  const sizeAttrList = getProductAttributeOptions(
    productDetailsContext.productVariants,
    'size',
  ) as SizeAttribute[];
  const colorAttrList = getProductAttributeOptions(
    productDetailsContext.productVariants,
    'color',
  ) as ColorAttribute[];
  const labelAttrList = getProductAttributeOptions(
    productDetailsContext.productVariants,
    'label',
  ) as ProductVariantOptions[number][];

  //  JSX
  return (
    <div className='grid min-w-0 gap-4 lg:col-span-2 xl:col-span-1'>
      <div className={`${styles.productPanel} ${styles.spaceLarge} min-w-0`}>
        <div className='space-y-3'>
          <h2 className='font-bold text-2xl'>{title}</h2>

          <div className='flex items-start gap-2'>
            <div className='space-y-3 cursor-pointer'>
              <h3 className={styles.priceHeading}>
                <Suspense fallback={<PriceSkeleton className='h-5 w-24' />}>
                  <GlobalProductPrice usdAmount={Number(retail_price)} />
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
              <>
                {sizeAttrList.length > 0 && (
                  <VariantAttributeSelector title='Size:' attribute='size' options={sizeAttrList} />
                )}
                {colorAttrList.length > 0 && (
                  <VariantAttributeSelector
                    title='Colors:'
                    attribute='color'
                    options={colorAttrList}
                  />
                )}
                {labelAttrList.length > 0 && (
                  <VariantAttributeSelector
                    title='Label:'
                    attribute='label'
                    options={labelAttrList}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Add to Cart and Buy Now buttons */}
        <div className={`${styles.purchaseActions} space-y-4`}>
          <AddToCart
            variants={productDetailsContext.productVariants}
            isLoadingVariants={variantsAreLoading}
          />

          <BuyNow />
        </div>
      </div>

      <DeliveryandPaymentsBanner />
    </div>
  );
};

export default ProductTitleAndSizesEtc;

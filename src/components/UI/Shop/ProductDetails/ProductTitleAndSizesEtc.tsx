import dynamic from 'next/dynamic';
import { useProductDetailsContext } from '.';
import { useCurrentVariant } from './currentVariantStore';
import { Suspense, useMemo } from 'react';
import { PriceSkeleton } from '../GlobalShopComponents/GlobalProductPrice';
import {
  ProductVariantsInterface,
  SizeAttribute,
  ColorAttribute,
  ProductVariantOptions,
} from '@/app/shop/product/[id]/productDetailsSSR';

const AddToCart = dynamic(() => import('./AddToCart').then((mod) => mod.AddToCart));
const BuyNow = dynamic(() => import('./BuyNow').then((mod) => mod.BuyNow));
const DeliveryandPaymentsBanner = dynamic(() =>
  import('./DeliveryandPaymentsBanner').then((mod) => mod.DeliveryandPaymentsBanner),
);
const VariantAttributeSelector = dynamic(() =>
  import('./VariantAttributeSelector').then((mod) => mod.default),
);
const GlobalProductPrice = dynamic(() =>
  import('../GlobalShopComponents/GlobalProductPrice').then((mod) => mod.default),
);

const getOptionsByAttribute = (variants: ProductVariantsInterface['data'], attrName: string) => [
  ...new Map(
    variants
      .flatMap((v) => v.options)
      .filter((o) => o.attribute?.name.toLowerCase() === attrName.toLowerCase())
      .map((o) => [o.value, o]),
  ).values(),
];

// Main Component
const ProductTitleAndSizesEtc = () => {
  // Hooks
  const productDetailsContext = useProductDetailsContext();
  const matchingVariant = useCurrentVariant((state) => state.matchingVariant);
  const metadata = productDetailsContext.productMetaData;

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

  const sizeAttrList = getOptionsByAttribute(
    productDetailsContext.productVariants,
    'size',
  ) as SizeAttribute[];
  const colorAttrList = getOptionsByAttribute(
    productDetailsContext.productVariants,
    'color',
  ) as ColorAttribute[];
  const labelAttrList = getOptionsByAttribute(
    productDetailsContext.productVariants,
    'label',
  ) as ProductVariantOptions[number][];

  //  JSX
  return (
    <div className='grid gap-4 lg:col-span-2 xl:col-span-1'>
      <div className='bg-[#4C3D3D3D] backdrop-blur-[10px] p-4 rounded-[20px] space-y-6 lg:p-8'>
        <div className='space-y-3'>
          <h2 className='font-bold text-2xl'>{title}</h2>

          <div className='flex items-start gap-2'>
            <div className='space-y-3 cursor-pointer'>
              <h3 className='font-bold text-xl select-none text-[1.1rem]'>
                <Suspense fallback={<PriceSkeleton className='h-5 w-24' />}>
                  <GlobalProductPrice usdAmount={Number(retail_price)} />
                </Suspense>
              </h3>

              {/* Stars */}
            </div>
          </div>
        </div>

        {/* Size, Color and Label Selectors */}
        {sizeAttrList.length > 0 && (
          <VariantAttributeSelector title='Size:' attribute='size' options={sizeAttrList} />
        )}
        {colorAttrList.length > 0 && (
          <VariantAttributeSelector title='Colors:' attribute='color' options={colorAttrList} />
        )}
        {labelAttrList.length > 0 && (
          <VariantAttributeSelector title='Label:' attribute='label' options={labelAttrList} />
        )}

        {/* Add to Cart and Buy Now buttons */}
        <div className='space-y-4'>
          <AddToCart variants={productDetailsContext.productVariants} />

          <BuyNow />
        </div>
      </div>

      <DeliveryandPaymentsBanner />
    </div>
  );
};

export default ProductTitleAndSizesEtc;

import dynamic from 'next/dynamic';
import { useProductDetailsContext } from '.';
import { useCurrentVariant } from './currentVariantStore';
import { useMemo } from 'react';

const DeliveryandPaymentsBanner = dynamic(() =>
  import('./DeliveryandPaymentsBanner').then(
    (mod) => mod.DeliveryandPaymentsBanner
  )
);
const AddToCart = dynamic(() =>
  import('./AddToCart').then((mod) => mod.AddToCart)
);
const BuyNow = dynamic(() => import('./BuyNow').then((mod) => mod.BuyNow));
const SizeSelector = dynamic(() =>
  import('./SizeSelector').then((mod) => mod.default)
);
const ColorsSelector = dynamic(() =>
  import('./ColorsSelector').then((mod) => mod.default)
);

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

  //  JSX
  return (
    <div className='grid gap-4'>
      <div className='bg-[#4C3D3D3D] backdrop-blur-[20px] p-4 rounded-[20px] space-y-6 lg:p-8'>
        <div className='space-y-3'>
          <h2 className='font-bold text-2xl'>{title}</h2>

          <div className='flex items-start gap-2'>
            <div className='space-y-1.5'>
              <p className='font-bold text-xl'>{`\$${retail_price}`}</p>

              {/* Stars */}
              <svg width='85' height='16' viewBox='0 0 85 16' fill='none'>
                <path
                  d='M7.57994 1.85667C7.94432 1.10486 9.01532 1.10486 9.3797 1.85667L10.8177 4.82357C10.9634 5.12426 11.2497 5.33229 11.5807 5.37801L14.848 5.82936C15.6755 5.94367 16.0064 6.9621 15.4041 7.54095L13.0262 9.82624C12.7853 10.0578 12.676 10.3943 12.7348 10.7232L13.3151 13.9692C13.4621 14.7915 12.5956 15.421 11.859 15.0269L8.95147 13.4716C8.65679 13.314 8.30284 13.314 8.00816 13.4716L5.10015 15.0269C4.36346 15.421 3.49703 14.7914 3.64415 13.969L4.22477 10.7233C4.28361 10.3943 4.17426 10.0577 3.93333 9.82618L1.55556 7.54095C0.953272 6.9621 1.28416 5.94367 2.11166 5.82936L5.37894 5.37801C5.70994 5.33229 5.99623 5.12426 6.14197 4.82356L7.57994 1.85667Z'
                  fill='white'
                />
                <path
                  d='M24.4022 1.85667C24.7666 1.10486 25.8376 1.10486 26.202 1.85667L27.6399 4.82357C27.7857 5.12426 28.072 5.33229 28.403 5.37801L31.6702 5.82936C32.4977 5.94367 32.8286 6.9621 32.2263 7.54095L29.8485 9.82624C29.6076 10.0578 29.4983 10.3943 29.5571 10.7232L30.1373 13.9692C30.2843 14.7915 29.4179 15.421 28.6812 15.0269L25.7737 13.4716C25.4791 13.314 25.1251 13.314 24.8304 13.4716L21.9224 15.0269C21.1857 15.421 20.3193 14.7914 20.4664 13.969L21.047 10.7233C21.1059 10.3943 20.9965 10.0577 20.7556 9.82618L18.3778 7.54095C17.7755 6.9621 18.1064 5.94367 18.9339 5.82936L22.2012 5.37801C22.5322 5.33229 22.8185 5.12426 22.9642 4.82356L24.4022 1.85667Z'
                  fill='white'
                />
                <path
                  d='M41.2264 1.85667C41.5908 1.10486 42.6618 1.10486 43.0262 1.85667L44.4642 4.82357C44.6099 5.12426 44.8962 5.33229 45.2272 5.37801L48.4945 5.82936C49.322 5.94367 49.6529 6.9621 49.0506 7.54095L46.6727 9.82624C46.4318 10.0578 46.3225 10.3943 46.3813 10.7232L46.9615 13.9692C47.1086 14.7915 46.2421 15.421 45.5055 15.0269L42.598 13.4716C42.3033 13.314 41.9493 13.314 41.6546 13.4716L38.7466 15.0269C38.0099 15.421 37.1435 14.7914 37.2906 13.969L37.8713 10.7233C37.9301 10.3943 37.8207 10.0577 37.5798 9.82618L35.202 7.54095C34.5998 6.9621 34.9306 5.94367 35.7581 5.82936L39.0254 5.37801C39.3564 5.33229 39.6427 5.12426 39.7885 4.82356L41.2264 1.85667Z'
                  fill='white'
                />
                <path
                  d='M58.0506 1.85667C58.415 1.10486 59.486 1.10486 59.8504 1.85667L61.2884 4.82357C61.4341 5.12426 61.7204 5.33229 62.0514 5.37801L65.3187 5.82936C66.1462 5.94367 66.4771 6.9621 65.8748 7.54095L63.497 9.82624C63.2561 10.0578 63.1467 10.3943 63.2055 10.7232L63.7858 13.9692C63.9328 14.7915 63.0663 15.421 62.3297 15.0269L59.4222 13.4716C59.1275 13.314 58.7735 13.314 58.4789 13.4716L55.5709 15.0269C54.8342 15.421 53.9677 14.7914 54.1148 13.969L54.6955 10.7233C54.7543 10.3943 54.645 10.0577 54.404 9.82618L52.0263 7.54095C51.424 6.9621 51.7549 5.94367 52.5824 5.82936L55.8496 5.37801C56.1806 5.33229 56.4669 5.12426 56.6127 4.82356L58.0506 1.85667Z'
                  fill='white'
                />
                <path
                  d='M74.8729 1.85667C75.2373 1.10486 76.3083 1.10486 76.6727 1.85667L78.1106 4.82357C78.2564 5.12426 78.5427 5.33229 78.8737 5.37801L82.1409 5.82936C82.9684 5.94367 83.2993 6.9621 82.697 7.54095L80.3192 9.82624C80.0783 10.0578 79.969 10.3943 80.0278 10.7232L80.608 13.9692C80.755 14.7915 79.8886 15.421 79.152 15.0269L76.2444 13.4716C75.9498 13.314 75.5958 13.314 75.3011 13.4716L72.3931 15.0269C71.6564 15.421 70.79 14.7914 70.9371 13.969L71.5177 10.7233C71.5766 10.3943 71.4672 10.0577 71.2263 9.82618L68.8485 7.54095C68.2462 6.9621 68.5771 5.94367 69.4046 5.82936L72.6719 5.37801C73.0029 5.33229 73.2892 5.12426 73.4349 4.82356L74.8729 1.85667Z'
                  fill='white'
                />
              </svg>

              <p className='text-sm'>Sold 45</p>
            </div>
          </div>
        </div>

        {/* Size and Color Selectors */}
        <SizeSelector />
        <ColorsSelector />

        {/* Add to Cart and Buy Now buttons */}
        <div className='space-y-4'>
          <AddToCart />

          <BuyNow />
        </div>
      </div>

      <DeliveryandPaymentsBanner />
    </div>
  );
};

export default ProductTitleAndSizesEtc;

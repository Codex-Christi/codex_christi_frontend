import Image from 'next/image';
import { launchMerchProducts } from '@/lib/utils/shopHomePageProductsData';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import DealsScrollControls from './DealsScrollControls';

// Top-Page Deals Component
const Deals = () => {
  const eagerImageCount = 2;
  const imageQuality = 80;
  const imageSizes =
    '(max-width: 640px) 80px, (max-width: 1024px) 125px, (min-width: 1280px) 120px, 160px';

  // Main JSX
  return (
    <div
      className='min-h-[21rem] md:min-h-[14rem] md:pt-12 pb-8 px-4 bg-[linear-gradient(95.55deg,_#9747FF_3.68%,_#4264FF_53.29%,_#007AFF_100%)] relative 
      md:grid md:grid-cols-12 md:gap-2 items-center'
    >
      {/* Launch Merch Text */}
      <CustomShopLink
        href='/shop/category/launch-merch'
        className='flex font-ocr justify-between md:gap-4 -ml-10 md:ml-[unset]
         md:col-span-4 md:flex-col place-items-center select-none md:scale-[0.6] lg:scale-100
      '
      >
        <div className=' -space-y-8 md:-space-y-2 flex flex-col items-center justify-center'>
          <p className='outlined-text scale-[0.6] md:scale-100 text-7xl -tracking-widest text-center'>
            Launch
          </p>
          <p className='outlined-text scale-[0.6] md:scale-100 text-7xl -tracking-widest text-center'>
            Merch
          </p>
        </div>
        <div className='text-center mt-0.5'>
          <div className='bg-white text-[#007AFF] font-bold rounded-lg py-2 px-4 mx-auto text-center w-auto inline-block'>
            Special Sales
          </div>
        </div>
      </CustomShopLink>

      {/* Product Slider Carousel */}
      <div
        id='launch-merch-products'
        className='overflow-x-auto overflow-y-hidden min-w-full flex gap-2 lg:gap-10 xl:gap-7
        scroll-smooth snap-x snap-mandatory md:grid-cols-5 md:w-full md:col-span-8 custom-scrollbar'
      >
        {launchMerchProducts.map((merch, i) => (
          <CustomShopLink
            className='w-[12rem] h-[12rem] md:h-[150px] relative shrink-0 overflow-hidden'
            href={`/shop/product/${merch.productId}`}
            key={merch.productId}
          >
            <Image
              className='!w-[20rem] !h-[22.5rem] block object-contain -mt-[90px] md:mt-0   
             md:!w-[10rem] md:!h-[150px] scale-[0.7] md:scale-[1.0]'
              src={`/${merch.image_name}`}
              fill
              fetchPriority={i < eagerImageCount ? 'high' : 'auto'}
              alt={merch.img_alt}
              draggable={false}
              loading={i < eagerImageCount ? 'eager' : 'lazy'}
              priority={i < eagerImageCount}
              quality={imageQuality}
              sizes={imageSizes}
            />
          </CustomShopLink>
        ))}
      </div>

      <DealsScrollControls targetId='launch-merch-products' />
    </div>
  );
};

export default Deals;

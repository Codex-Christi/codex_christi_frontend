'use client';

import Image from 'next/image';
import { lauchMerchProducts } from '@/lib/utils/shopHomePageProductsData';
import { useRef } from 'react';
import { GalleryPrevButton as CarouselPrev } from '../ProductDetails/GalleryPrevButton';
import { GalleryNextButton as CarouselNext } from '../ProductDetails/GalleryNextButton';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import { useResponsiveSSRValue } from '@/lib/hooks/useResponsiveSSR_Store';
import { useAutoScroller } from './useAutoScroller';

// Top-Page Deals Component
const Deals = () => {
  const slideContainerRef = useRef<HTMLDivElement | null>(null);
  const { isMobileAndTablet, isMobile, isTabletOnly } = useResponsiveSSRValue();

  const { nudgeScroll } = useAutoScroller(
    slideContainerRef,
    { isMobileAndTablet, isMobile, isTabletOnly },
    {
      // auto is true on mobile/tablet by default; you can force:
      // auto: true,
      // respectReducedMotion: true,
      // snapManage: true,
      // override nudge defaults if you like:
      // nudge: { fraction: 0.33, duration: 600, minPx: 60, maxPx: 180 },
    },
  );

  // Main JSX
  return (
    <div
      className='md:pt-12 pb-8 px-4  bg-[linear-gradient(95.55deg,_#9747FF_3.68%,_#4264FF_53.29%,_#007AFF_100%)] relative md:grid md:grid-cols-12 md:gap-2
    items-center'
    >
      {/* Launch Merch Text */}
      <CustomShopLink
        href='/shop/category/lauch-merch'
        className='flex font-ocr justify-between md:gap-4 -ml-10 md:ml-[unset]
         md:col-span-3 md:flex-col place-items-center select-none md:scale-[0.6] lg:scale-100
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

      <div
        className='overflow-x-auto overflow-y-hidden min-w-full flex gap-2 md:gap-8 custom-scrollbar 
        scroll-smooth snap-x snap-mandatory md:justify-items-center  md:content-center
        md:grid md:grid-cols-5 md:w-full md:col-span-9'
        ref={slideContainerRef}
      >
        {lauchMerchProducts.map((merch, i) => (
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
              fetchPriority={i === 0 ? 'high' : 'auto'}
              alt={merch.img_alt}
              draggable={false}
              onDragStart={(e) => e.preventDefault()} // prevent ghost drag only
              priority
              quality={100}
              sizes='(max-width: 412px) 120px, (max-width: 640px) 120px, (max-width: 1024px) 125px, (min-width: 1280px) 120px, 200px'
            />
          </CustomShopLink>
        ))}
      </div>

      {/* NOTE: Desktop currently performs no scroll. To enable later:
          // onClick={() => nudgeScroll('right', { fraction: 0.33, duration: 450 })}
      */}
      <CarouselPrev
        className='absolute top-[40%] left-0  md:hidden'
        onClick={() => (isMobileAndTablet ? nudgeScroll('left') : undefined)}
        aria-label='Scroll left'
      />

      <CarouselNext
        className='absolute top-[40%] right-0 md:hidden'
        onClick={() => (isMobileAndTablet ? nudgeScroll('right') : undefined)}
        aria-label='Scroll right'
      />
    </div>
  );
};

export default Deals;

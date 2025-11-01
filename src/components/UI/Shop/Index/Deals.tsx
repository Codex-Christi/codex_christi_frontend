'use client';

import Image from 'next/image';
import Link from 'next/link';
import { lauchMerchProducts } from '@/lib/utils/shop_home_pics';
import { useRef } from 'react';
import { imagePreventDefaults } from '../ProductDetails/ProductImageGallery';
import { GalleryPrevButton as CarouselPrev } from '../ProductDetails/GalleryPrevButton';
import { GalleryNextButton as CarouselNext } from '../ProductDetails/GalleryNextButton';
import CustomShopLink from '../HelperComponents/CustomShopLink';

// Top-Page Deals Component
const Deals = () => {
  const slideContainer = useRef<HTMLDivElement | null>(null);

  const scrollByWidth = (direction: 'left' | 'right') => {
    const container = slideContainer.current;
    if (!container) return;

    const style = getComputedStyle(container);
    const gap = parseFloat(style.gap || style.columnGap || '0') || 0;

    const visibleWidth = container.clientWidth;

    const firstChild = container.querySelector<HTMLElement>(':scope > *');

    if (firstChild) {
      const itemRect = firstChild.getBoundingClientRect();
      const itemWidth = Math.round(itemRect.width);
      const stepCount = Math.max(1, Math.floor(visibleWidth / (itemWidth + gap)));

      const scrollAmount = (itemWidth + gap) * stepCount;

      const target =
        direction === 'left'
          ? Math.max(0, container.scrollLeft - scrollAmount)
          : container.scrollLeft + scrollAmount;

      container.scrollTo({ left: target, behavior: 'smooth' });
      return;
    }

    const fallbackAmount = visibleWidth + gap;

    container.scrollTo({
      left:
        direction === 'left'
          ? container.scrollLeft - fallbackAmount
          : container.scrollLeft + fallbackAmount,
      behavior: 'smooth',
    });
  };

  return (
    <div
      className='pt-12 pb-8 px-4 bg-[linear-gradient(95.55deg,_#9747FF_3.68%,_#4264FF_53.29%,_#007AFF_100%)] relative md:grid md:grid-cols-12 md:gap-2
    items-center'
    >
      {/* Launch Merch Text */}
      <CustomShopLink
        href='/shop/category/lauch-merch'
        className='hidden font-ocr md:col-span-3 md:flex place-items-center select-none md:scale-[0.6] lg:scale-100
      '
      >
        <div>
          <div className='-space-y-2'>
            <p className='outlined-text text-7xl -tracking-widest text-center'>Launch</p>
            <p className='outlined-text text-7xl -tracking-widest text-center'>Merch</p>
          </div>
          <div className='text-center mt-0.5'>
            <div className='bg-white text-[#007AFF] font-bold rounded-lg py-2 px-4 mx-auto text-center w-auto inline-block'>
              Special Sales
            </div>
          </div>
        </div>
      </CustomShopLink>

      <div
        className='overflow-x-auto overflow-y-hidden min-w-full flex gap-2 md:gap-8 custom-scrollbar 
        scroll-smooth snap-x snap-mandatory 
        md:grid md:grid-cols-5 md:w-full md:col-span-9'
        ref={slideContainer}
      >
        {lauchMerchProducts.map((merch) => (
          <Link
            className='w-[12rem] h-[12rem] md:h-[150px] relative shrink-0 overflow-hidden'
            href={`/shop/product/${merch.productId}`}
            key={merch.productId}
          >
            <Image
              className='!w-[20rem] !h-[22.5rem] block object-cover -mt-[90px] md:mt-0   
             md:!w-[10rem] md:!h-[150px] md:scale-[1.75] xl:scale-[1.9]'
              src={`/${merch.image_name}`}
              fill
              alt={merch.img_alt}
              {...imagePreventDefaults}
              priority
              quality={100}
              sizes='(max-width: 412px) 80px, (max-width: 640px) 100px, (max-width: 1024px) 120px, (min-width: 1280px) 150px, 200px'
            />
          </Link>
        ))}
      </div>

      <CarouselPrev
        className='absolute top-[40%] left-0  md:hidden'
        onClick={() => scrollByWidth('left')}
        aria-label='Scroll left'
      />

      <CarouselNext
        className='absolute top-[40%] right-0 md:hidden'
        onClick={() => scrollByWidth('right')}
        aria-label='Scroll right'
      />
    </div>
  );
};

export default Deals;

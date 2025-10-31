'use client';

import Image from 'next/image';
import Link from 'next/link';
import { lauchMerchProducts } from '@/lib/utils/shop_home_pics';
import { useRef } from 'react';

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
    <div className='pt-12 pb-8 px-4 bg-[linear-gradient(95.55deg,_#9747FF_3.68%,_#4264FF_53.29%,_#007AFF_100%)] relative lg:grid lg:grid-cols-12 lg:gap-2'>
      <div className='hidden font-ocr lg:col-span-3 lg:flex place-items-center'>
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
      </div>

      <div
        className='overflow-x-auto min-w-full flex gap-8 custom-scrollbar scroll-smooth snap-x snap-mandatory lg:grid lg:grid-cols-5 lg:w-full lg:col-span-9'
        ref={slideContainer}
      >
        {lauchMerchProducts.map((merch) => (
          <Link
            className='w-full h-[300px] relative shrink-0 sm:min-w-[45%] lg:w-auto'
            href={`/shop/product/${merch.productId}`}
            key={merch.productId}
          >
            <Image
              className='w-full h-full block object-cover'
              src={`/${merch.image_name}`}
              fill
              alt={merch.img_alt}
              priority
              quality={100}
            />
          </Link>
        ))}
      </div>

      <button
        className='absolute top-[40%] left-0 -rotate-180 lg:hidden'
        type='button'
        onClick={() => scrollByWidth('left')}
        aria-label='Scroll left'
      >
        <svg
          width='57'
          height='57'
          viewBox='0 0 57 57'
          fill='none'
          xmlns='http://www.w3.org/2000/svg'
        >
          <g filter='url(#filter0_d_589_1207)'>
            <foreignObject x='-3.63672' y='-3.95935' width='56' height='56'>
              <div className='[backdrop-filter:blur(2px)] [clip-path:url(#bgblur_0_589_1207_clip_path)] [height:100%] [width:100%]'></div>
            </foreignObject>
            <circle
              data-figma-bg-blur-radius='4'
              cx='24.3633'
              cy='24.0406'
              r='24'
              fill='white'
              fillOpacity='0.8'
            />
            <path
              d='M18.3633 31.4669C18.3617 31.9248 18.496 32.3728 18.7493 32.7543C19.0026 33.1357 19.3635 33.4333 19.7861 33.6095C20.2088 33.7856 20.6742 33.8322 21.1235 33.7435C21.5727 33.6548 21.9854 33.4347 22.3094 33.1111L29.6857 25.7266C29.9015 25.5108 30.0724 25.2544 30.1884 24.9722C30.3045 24.69 30.3634 24.3875 30.3619 24.0824C30.3619 24.0557 30.3619 24.031 30.3619 24.0063C30.373 23.6903 30.3189 23.3753 30.2029 23.0811C30.0869 22.7869 29.9115 22.5198 29.6877 22.2964L22.3073 14.9303C21.8702 14.5146 21.2878 14.2862 20.6846 14.2939C20.0813 14.3016 19.505 14.5447 19.0785 14.9714C18.6521 15.3982 18.4093 15.9746 18.402 16.5779C18.3947 17.1811 18.6235 17.7633 19.0395 18.2002L24.8558 24.0166L19.0395 29.833C18.8249 30.0475 18.6547 30.3022 18.5387 30.5826C18.4227 30.863 18.3631 31.1635 18.3633 31.4669Z'
              fill='black'
            />
          </g>
          <defs>
            <filter
              id='filter0_d_589_1207'
              x='0.363281'
              y='0.0406494'
              width='56'
              height='56'
              filterUnits='userSpaceOnUse'
              colorInterpolationFilters='sRGB'
            >
              <feFlood floodOpacity='0' result='BackgroundImageFix' />
              <feColorMatrix
                in='SourceAlpha'
                type='matrix'
                values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0'
                result='hardAlpha'
              />
              <feOffset dx='4' dy='4' />
              <feGaussianBlur stdDeviation='2' />
              <feComposite in2='hardAlpha' operator='out' />
              <feColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.2 0' />
              <feBlend
                mode='normal'
                in2='BackgroundImageFix'
                result='effect1_dropShadow_589_1207'
              />
              <feBlend
                mode='normal'
                in='SourceGraphic'
                in2='effect1_dropShadow_589_1207'
                result='shape'
              />
            </filter>
            <clipPath id='bgblur_0_589_1207_clip_path' transform='translate(3.63672 3.95935)'>
              <circle cx='24.3633' cy='24.0406' r='24' />
            </clipPath>
          </defs>
        </svg>
      </button>

      <button
        className='absolute top-[40%] right-0 lg:hidden'
        type='button'
        onClick={() => scrollByWidth('right')}
        aria-label='Scroll right'
      >
        <svg
          width='57'
          height='57'
          viewBox='0 0 57 57'
          fill='none'
          xmlns='http://www.w3.org/2000/svg'
        >
          <g filter='url(#filter0_d_589_1207)'>
            <foreignObject x='-3.63672' y='-3.95935' width='56' height='56'>
              <div className='[backdrop-filter:blur(2px)] [clip-path:url(#bgblur_0_589_1207_clip_path)] [height:100%] [width:100%]'></div>
            </foreignObject>
            <circle
              data-figma-bg-blur-radius='4'
              cx='24.3633'
              cy='24.0406'
              r='24'
              fill='white'
              fillOpacity='0.8'
            />
            <path
              d='M18.3633 31.4669C18.3617 31.9248 18.496 32.3728 18.7493 32.7543C19.0026 33.1357 19.3635 33.4333 19.7861 33.6095C20.2088 33.7856 20.6742 33.8322 21.1235 33.7435C21.5727 33.6548 21.9854 33.4347 22.3094 33.1111L29.6857 25.7266C29.9015 25.5108 30.0724 25.2544 30.1884 24.9722C30.3045 24.69 30.3634 24.3875 30.3619 24.0824C30.3619 24.0557 30.3619 24.031 30.3619 24.0063C30.373 23.6903 30.3189 23.3753 30.2029 23.0811C30.0869 22.7869 29.9115 22.5198 29.6877 22.2964L22.3073 14.9303C21.8702 14.5146 21.2878 14.2862 20.6846 14.2939C20.0813 14.3016 19.505 14.5447 19.0785 14.9714C18.6521 15.3982 18.4093 15.9746 18.402 16.5779C18.3947 17.1811 18.6235 17.7633 19.0395 18.2002L24.8558 24.0166L19.0395 29.833C18.8249 30.0475 18.6547 30.3022 18.5387 30.5826C18.4227 30.863 18.3631 31.1635 18.3633 31.4669Z'
              fill='black'
            />
          </g>
          <defs>
            <filter
              id='filter0_d_589_1207'
              x='0.363281'
              y='0.0406494'
              width='56'
              height='56'
              filterUnits='userSpaceOnUse'
              colorInterpolationFilters='sRGB'
            >
              <feFlood floodOpacity='0' result='BackgroundImageFix' />
              <feColorMatrix
                in='SourceAlpha'
                type='matrix'
                values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0'
                result='hardAlpha'
              />
              <feOffset dx='4' dy='4' />
              <feGaussianBlur stdDeviation='2' />
              <feComposite in2='hardAlpha' operator='out' />
              <feColorMatrix type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.2 0' />
              <feBlend
                mode='normal'
                in2='BackgroundImageFix'
                result='effect1_dropShadow_589_1207'
              />
              <feBlend
                mode='normal'
                in='SourceGraphic'
                in2='effect1_dropShadow_589_1207'
                result='shape'
              />
            </filter>
            <clipPath id='bgblur_0_589_1207_clip_path' transform='translate(3.63672 3.95935)'>
              <circle cx='24.3633' cy='24.0406' r='24' />
            </clipPath>
          </defs>
        </svg>
      </button>
    </div>
  );
};

export default Deals;

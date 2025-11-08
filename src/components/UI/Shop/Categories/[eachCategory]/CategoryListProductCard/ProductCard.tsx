// app/category/[id]/ProductCard.tsx
'use client';

import Image from 'next/image';
import CustomShopLink from '@/components/UI/Shop/HelperComponents/CustomShopLink';
import type { CategoryProductDetail } from '@/app/shop/category/[id]/categoryDetailsSSR';
import dynamic from 'next/dynamic';
import GlobalProductPrice, {
  PriceSkeleton,
} from '../../../GlobalShopComponents/GlobalProductPrice';
import { Suspense } from 'react';

const SizeAndColorSelectorPopover = dynamic(
  () =>
    import(
      '@/components/UI/Shop/Categories/[eachCategory]/CategoryListProductCard/SizeAndColorSelectorPopover'
    ).then((mod) => mod.default),
  { ssr: false },
);

export default function ProductCard({ product }: { product: CategoryProductDetail }) {
  const { title, _id, slug } = product;

  return (
    <div
      className='relative bg-white/10 backdrop-blur-md rounded-xl py-8 pt-0 
                 border-[2px] border-white/50 overflow-hidden mx-auto w-full max-w-[310px]
                 lg:max-w-[350px] hover:scale-[1.03] !select-none'
    >
      {/* 1) The stretched link overlay that makes the WHOLE card clickable */}
      <CustomShopLink
        href={`/shop/product/${_id}`}
        aria-label={`${title} details`}
        className='absolute inset-0 z-10'
      />

      {/* 2) Card content (sits visually above background but *under* the link overlay by default) */}
      <div className='relative'>
        <div className='relative h-auto'>
          <Image
            src={product.image}
            alt={product.title}
            height={300}
            width={150}
            fetchPriority='high'
            className='object-cover object-top aspect-[16/18] md:aspect-[16/13] !w-full'
            style={{ filter: isDayOrNight() === 'night' ? 'brightness(.9)' : 'none' }}
          />
        </div>

        <div className='pt-4 px-4 flex flex-col gap-2'>
          <h3 className='font-semibold text-lg mb-1'>{product.title}</h3>
          <div className='flex justify-between items-center'>
            <h4 className='font-bold'>
              <Suspense fallback={<PriceSkeleton className='h-5 w-24' />}>
                <GlobalProductPrice usdAmount={Number(Number(product.retail_price).toFixed(2))} />
              </Suspense>
            </h4>

            {/* 3) Raise the Popover trigger ABOVE the stretched link (so it’s clickable) */}
            <div className='relative z-20'>
              <SizeAndColorSelectorPopover
                productId={_id}
                productTitle={title}
                productSlug={slug}
                buttonProps={{
                  type: 'button',
                  name: `Add ${product.title} to cart`,
                  className: `px-3 py-1 bg-[#0085FF] font-ocr text-[0.95rem] font-[900] rounded-md hover:bg-gray-500 
                    transition-colors hover:scale-110`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function isDayOrNight() {
  const h = new Date().getHours();
  return h >= 6 && h < 20 ? 'day' : 'night';
}

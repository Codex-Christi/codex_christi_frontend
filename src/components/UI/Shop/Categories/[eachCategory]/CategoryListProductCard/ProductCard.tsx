import Image from 'next/image';
import CustomShopLink from '@/components/UI/Shop/HelperComponents/CustomShopLink';
import type { CategoryProductDetail } from '@/app/shop/category/[id]/categoryDetailsSSR';
import GlobalProductPrice, {
  PriceSkeleton,
} from '../../../GlobalShopComponents/GlobalProductPrice';
import { Suspense } from 'react';
import SizeAndColorSelectorPopover from './SizeAndColorSelectorPopover';

export type CategoryProductCardData = Pick<
  CategoryProductDetail,
  '_id' | 'title' | 'slug' | 'image' | 'retail_price'
>;

export default function ProductCard({
  product,
  priority = false,
}: {
  product: CategoryProductCardData;
  priority?: boolean;
}) {
  const { title, _id, slug } = product;

  return (
    <div
      className='relative bg-white/10 backdrop-blur-md rounded-xl py-8 pt-0 
                 border-[2px] border-white/50 overflow-hidden mx-auto w-full max-w-[310px]
                 lg:max-w-[350px] hover:scale-[1.03] !select-none'
    >
      <CustomShopLink
        href={`/shop/product/${_id}`}
        aria-label={`${title} details`}
        className='absolute inset-0 z-10'
      />

      <div className='relative'>
        <div className='relative h-auto'>
          <Image
            src={product.image}
            alt={product.title}
            height={300}
            width={150}
            preload={priority}
            loading={priority ? undefined : 'lazy'}
            sizes='(max-width: 639px) min(306px, calc(100vw - 68px)), (max-width: 899px) min(306px, calc((100vw - 96px) / 2)), (max-width: 1279px) min(346px, calc((100vw - 124px) / 3)), min(346px, calc((100vw - 152px) / 4))'
            className='h-auto w-full object-cover object-top aspect-[16/18] md:aspect-[16/13]'
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

            {/* Keep the picker above the card-wide link. */}
            <div className='relative z-20'>
              {_id && (
                <SizeAndColorSelectorPopover
                  productId={_id}
                  productTitle={title}
                  productSlug={slug}
                  buttonProps={{
                    type: 'button',
                    name: `Add ${product.title} to cart`,
                    className: `px-3 py-1 bg-[#0066CC] font-ocr text-[0.95rem] font-[900] rounded-md hover:bg-gray-500
                    transition-colors hover:scale-110`,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

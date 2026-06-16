'use client';

import Image from 'next/image';
import { useContext, useEffect, useMemo, useState, type ComponentType } from 'react';
import { ProductDetailsContext } from '..';
import { useAfterInitialPageLoad } from '@/lib/hooks/useAfterInitialPageLoad';
import { toMerchizeImageUrl } from '@/lib/merchizeStorefront/imageUrls';
import type { BasicProductInterface } from '@/lib/merchizeStorefront/productTypes';
import { imagePreventDefaults } from './galleryShared';

type ProductImageGalleryProps = {
  productMetaData?: BasicProductInterface['data'];
  initialImageUrls?: string[];
};

type InteractiveGalleryComponent = ComponentType<ProductImageGalleryProps>;

const EMPTY_IMAGE_URLS: string[] = [];

function resolveInitialImages(
  metadata?: BasicProductInterface['data'],
  initialImageUrls?: string[],
) {
  if (initialImageUrls?.length) return initialImageUrls;
  const fallback = toMerchizeImageUrl(metadata?.image);
  return fallback ? [fallback] : [];
}

function ProductImageGalleryPreview({
  productMetaData,
  initialImageUrls,
}: ProductImageGalleryProps) {
  const images = resolveInitialImages(productMetaData, initialImageUrls);
  const firstImageSrc = images[0];
  const title = productMetaData?.title || 'Product image';

  return (
    <div
      className='bg-[#4C3D3D3D] backdrop-blur-[10px] p-4 rounded-[20px] space-y-2 lg:p-8 flex flex-col gap-8 items-start sm:gap-12 sm:flex-row lg:flex-col-reverse xl:flex-row'
      id='mainGallery'
    >
      <div
        className='grid gap-4 grid-cols-5 order-2 sm:grid-cols-1 sm:order-1 lg:grid-cols-5 xl:grid-cols-1 xl:order-1'
        aria-hidden='true'
      >
        <div className='rounded-[18px] sm:rounded-[20px] size-16 sm:size-20 border-[2.5px] border-white shadow-md shadow-gray-300 overflow-hidden bg-black/10'>
          {firstImageSrc && (
            <Image
              {...imagePreventDefaults}
              alt=''
              className='rounded-[20px] size-full object-cover object-top'
              src={firstImageSrc}
              width={80}
              height={80}
              quality={70}
              loading='lazy'
            />
          )}
        </div>
      </div>

      <div className='flex items-start w-full h-full gap-4 sm:gap-8 sm:order-2'>
        <div className='rounded-[20px] w-[95%] h-full relative'>
          <div className='relative size-full aspect-[16/18] md:aspect-[16/13] rounded-[20px] overflow-hidden bg-black/10'>
            {firstImageSrc ? (
              <Image
                {...imagePreventDefaults}
                priority
                fetchPriority='high'
                loading='eager'
                decoding='sync'
                className='size-full object-cover object-top'
                fill
                src={firstImageSrc}
                alt={title}
                sizes='(max-width: 640px) calc(100vw - 50px), (max-width: 1024px) 620px, (min-width: 1280px) 640px, 600px'
                quality={80}
              />
            ) : (
              <div className='grid size-full place-items-center text-sm text-white/60'>
                Product image unavailable
              </div>
            )}
          </div>
        </div>

        <div className='grid gap-8' aria-hidden='true'>
          <span className='block h-6 w-6 rounded-full bg-white/15' />
          <span className='block h-6 w-6 rounded-full bg-white/15' />
          <span className='block h-6 w-6 rounded-full bg-white/15' />
        </div>
      </div>
    </div>
  );
}

export const ProductImageGallery: React.FC<ProductImageGalleryProps> = ({
  productMetaData,
  initialImageUrls,
}) => {
  const productDetailsContext = useContext(ProductDetailsContext);
  const metadata = productMetaData ?? productDetailsContext?.productMetaData;
  const stableInitialImageUrls = useMemo(
    () => initialImageUrls ?? productDetailsContext?.initialImageUrls ?? EMPTY_IMAGE_URLS,
    [initialImageUrls, productDetailsContext?.initialImageUrls],
  );
  const ready = useAfterInitialPageLoad(1800);
  const [InteractiveGallery, setInteractiveGallery] =
    useState<InteractiveGalleryComponent | null>(null);

  useEffect(() => {
    if (!ready || InteractiveGallery) return;

    let cancelled = false;

    void import('./InteractiveProductImageGallery').then((module) => {
      if (!cancelled) {
        setInteractiveGallery(() => module.InteractiveProductImageGallery);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [InteractiveGallery, ready]);

  const preview = useMemo(
    () => (
      <ProductImageGalleryPreview
        productMetaData={metadata}
        initialImageUrls={stableInitialImageUrls}
      />
    ),
    [metadata, stableInitialImageUrls],
  );

  if (!InteractiveGallery) return preview;

  return (
    <InteractiveGallery productMetaData={metadata} initialImageUrls={stableInitialImageUrls} />
  );
};

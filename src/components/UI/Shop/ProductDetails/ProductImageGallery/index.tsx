'use client';

import Image from 'next/image';
import { useContext, useEffect, useMemo, useState, type ComponentType } from 'react';
import { ProductDetailsContext } from '..';
import { toMerchizeImageUrl } from '@/lib/merchizeStorefront/imageUrls';
import type { BasicProductInterface } from '@/lib/merchizeStorefront/productTypes';
import { imagePreventDefaults } from './galleryShared';
import { useCurrentVariant } from '../currentVariantStore';

type ProductImageGalleryProps = {
  productMetaData?: BasicProductInterface['data'];
  initialImageUrls?: string[];
  initialOpen?: boolean;
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
  onOpenFullscreen,
  onRequestInteractive,
  onShare,
}: ProductImageGalleryProps & {
  onOpenFullscreen: () => void;
  onRequestInteractive: () => void;
  onShare: () => void;
}) {
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
              quality={75}
              loading='lazy'
            />
          )}
        </div>
      </div>

      <div className='flex flex-col items-start w-full h-full gap-4 sm:flex-row sm:gap-8 sm:order-2'>
        <div className='rounded-[20px] w-full h-full relative sm:w-[95%]'>
          <div
            className='relative size-full aspect-[16/18] md:aspect-[16/13] rounded-[20px] overflow-hidden bg-black/10'
            role='button'
            tabIndex={0}
            aria-label='Open product image gallery'
            onPointerDown={onRequestInteractive}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpenFullscreen();
              }
            }}
          >
            {firstImageSrc ? (
              <Image
                {...imagePreventDefaults}
                priority
                fetchPriority='high'
                loading='eager'
                decoding='async'
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

        <div className='grid grid-cols-2 gap-6 sm:grid-cols-1 sm:gap-8'>
          <button
            type='button'
            name='Fullscreen button'
            aria-label='Open fullscreen'
            className='grid size-7 place-items-center bg-transparent p-0'
            onClick={onOpenFullscreen}
          >
            <svg width='26' height='26' viewBox='0 0 26 26' fill='none' aria-hidden='true'>
              <path
                d='M24.4 1H15.5M24.4 1v8.8M24.4 1l-9.2 9.2M1.3 15.8v8.8m0 0h8.9m-8.9 0 9.3-9.3'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </button>

          <button
            type='button'
            name='Share Product button'
            aria-label='Share this product'
            className='grid size-7 place-items-center bg-transparent p-0'
            onClick={onShare}
          >
            <svg width='22' height='26' viewBox='0 0 22 26' fill='none' aria-hidden='true'>
              <circle cx='17.5' cy='4' r='3' stroke='currentColor' strokeWidth='2' />
              <circle cx='5.5' cy='13' r='4' stroke='currentColor' strokeWidth='2' />
              <circle cx='17.5' cy='22' r='3' stroke='currentColor' strokeWidth='2' />
              <path d='m8.7 10.6 6.4-4.8M8.7 15.4l6.4 4.8' stroke='currentColor' strokeWidth='2' />
            </svg>
          </button>
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
  const hasVariantSelection = useCurrentVariant((state) =>
    Object.values(state.currentVariantOptions).some(Boolean),
  );
  const stableInitialImageUrls = useMemo(
    () => initialImageUrls ?? productDetailsContext?.initialImageUrls ?? EMPTY_IMAGE_URLS,
    [initialImageUrls, productDetailsContext?.initialImageUrls],
  );
  const [interactiveRequested, setInteractiveRequested] = useState(false);
  const [openInteractiveOnLoad, setOpenInteractiveOnLoad] = useState(false);
  const [InteractiveGallery, setInteractiveGallery] =
    useState<InteractiveGalleryComponent | null>(null);
  const shouldLoadInteractive = interactiveRequested || hasVariantSelection;

  useEffect(() => {
    if (shouldLoadInteractive) return;

    const requestInteractiveGallery = () => setInteractiveRequested(true);
    const listenerOptions = { once: true, passive: true } as const;

    window.addEventListener('scroll', requestInteractiveGallery, listenerOptions);

    return () => {
      window.removeEventListener('scroll', requestInteractiveGallery);
    };
  }, [shouldLoadInteractive]);

  useEffect(() => {
    if (!shouldLoadInteractive || InteractiveGallery) return;

    let cancelled = false;

    void import('./InteractiveProductImageGallery').then((module) => {
      if (!cancelled) {
        setInteractiveGallery(() => module.InteractiveProductImageGallery);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [InteractiveGallery, shouldLoadInteractive]);

  const preview = useMemo(
    () => (
      <ProductImageGalleryPreview
        productMetaData={metadata}
        initialImageUrls={stableInitialImageUrls}
        onOpenFullscreen={() => {
          setOpenInteractiveOnLoad(true);
          setInteractiveRequested(true);
        }}
        onRequestInteractive={() => setInteractiveRequested(true)}
        onShare={() => {
          void shareProduct(metadata?.title ?? 'Product');
        }}
      />
    ),
    [metadata, stableInitialImageUrls],
  );

  if (!InteractiveGallery) return preview;

  return (
    <InteractiveGallery
      productMetaData={metadata}
      initialImageUrls={stableInitialImageUrls}
      initialOpen={openInteractiveOnLoad}
    />
  );
};

async function shareProduct(productTitle: string) {
  const shareData = {
    title: `${productTitle} | Codex Christi Shop`,
    text: 'Check out this merch from Codex Christi.',
    url: window.location.href,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      return;
    }

    await navigator.clipboard.writeText(shareData.url);
    const { default: successToast } = await import('@/lib/success-toast');
    successToast({ message: 'Product URL copied to clipboard.' });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;

    const { default: errorToast } = await import('@/lib/error-toast');
    errorToast({ message: 'Unable to share this product right now.' });
  }
}

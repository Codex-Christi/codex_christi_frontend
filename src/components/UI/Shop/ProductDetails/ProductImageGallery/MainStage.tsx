// MainStage.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from '@/components/UI/primitives/carousel';
import {
  LoadingOverlay,
  type ImageListLoaderReturnType,
  imagePreventDefaults,
} from './galleryShared';
import Image from 'next/image';
import { GalleryPrevButton } from '../GalleryPrevButton';
import { GalleryNextButton } from '../GalleryNextButton';

function MainStage({
  images,
  metaTitle,
  setOpen,
  api,
  setApi,
  loader,
}: {
  images: string[];
  metaTitle?: string;
  setOpen: (v: boolean) => void;
  api: CarouselApi | null;
  setApi: (api: CarouselApi) => void;
  loader: ImageListLoaderReturnType;
}) {
  const imageKey = useMemo(() => images.join('|'), [images]);
  const [deferredImageKey, setDeferredImageKey] = useState('');
  const renderDeferredImages = deferredImageKey === imageKey;

  useEffect(() => {
    const scheduleDeferredImages = () => setDeferredImageKey(imageKey);

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(scheduleDeferredImages, { timeout: 1200 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = setTimeout(scheduleDeferredImages, 400);
    return () => clearTimeout(timeoutId);
  }, [imageKey]);

  return (
    <div className='rounded-[20px] w-full h-full relative sm:w-[95%]'>
      <Carousel
        className='w-full'
        opts={{ align: 'start', watchDrag: true, loop: true }}
        setApi={setApi}
      >
        <CarouselContent>
          {images.map((src, i) => {
            const shouldRenderImage = i === 0 || renderDeferredImages;

            return (
              <CarouselItem key={i} className='basis-full'>
                <div
                  className='relative size-full aspect-[16/18] md:aspect-[16/13] rounded-[20px] overflow-hidden cursor-zoom-in'
                  onClick={() => setOpen(true)}
                >
                  {shouldRenderImage ? (
                    <Image
                      {...imagePreventDefaults}
                      priority={i === 0}
                      fetchPriority={i === 0 ? 'high' : 'low'}
                      loading={i === 0 ? 'eager' : 'lazy'}
                      decoding={i === 0 ? 'sync' : 'async'}
                      className='size-full object-cover object-top'
                      fill
                      src={loader.srcWithRetry(src, i)}
                      alt={metaTitle || 'Product image'}
                      sizes='(max-width: 640px) calc(100vw - 50px), (max-width: 1024px) 620px, (min-width: 1280px) 640px, 600px'
                      quality={75}
                      onLoad={() => loader.markLoaded(i, src)}
                      onError={() => loader.markFailed(i)}
                    />
                  ) : (
                    <div aria-hidden='true' className='size-full bg-black/10' />
                  )}
                  <LoadingOverlay
                    show={
                      shouldRenderImage && (loader.failed[i] || (i !== 0 && !loader.loaded[i]))
                    }
                    onRetry={loader.failed[i] ? () => loader.retryOne(i) : undefined}
                  />
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>

        {images.length > 1 && (
          <>
            <GalleryPrevButton onClick={() => api?.scrollPrev()} />
            <GalleryNextButton onClick={() => api?.scrollNext()} />
          </>
        )}
      </Carousel>
    </div>
  );
}

export default MainStage;

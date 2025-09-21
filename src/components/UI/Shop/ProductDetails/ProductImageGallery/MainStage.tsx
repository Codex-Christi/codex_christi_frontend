// MainStage.tsx
'use client';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/UI/primitives/carousel';
import Image from 'next/image';
import { LoadingOverlay, isCloudfrontUrl, prevent, type ImageListLoaderReturnType } from '.';
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
  return (
    <div className='rounded-[20px] w-[95%] h-full relative'>
      <Carousel
        className='w-full'
        opts={{ align: 'start', watchDrag: true, loop: true }}
        setApi={setApi}
      >
        <CarouselContent>
          {images.map((src, i) => {
            const isCF = isCloudfrontUrl(src);
            const mainWidth = 1200; // choose appropriate main width
            const direct = isCF
              ? `${loader.srcWithRetry(src, i)}${src.includes('?') ? '&' : '?'}w=${mainWidth}&q=90`
              : loader.srcWithRetry(src, i);

            return (
              <CarouselItem key={i} className='basis-full'>
                <div
                  className='relative size-full aspect-[16/18] md:aspect-[16/13] rounded-[20px] overflow-hidden cursor-zoom-in'
                  onClick={() => setOpen(true)}
                >
                  <Image
                    {...prevent}
                    priority={i === 0}
                    className='size-full object-cover object-top'
                    fill
                    src={direct}
                    alt={metaTitle || 'Product image'}
                    sizes='(max-width: 640px) 100vw, (max-width: 1280px) 70vw, 800px'
                    quality={90}
                    onLoad={() => loader.markLoaded(i, src)}
                    onError={() => loader.markFailed(i)}
                    unoptimized={isCF} // bypass Next optimizer for CloudFront images
                  />
                  <LoadingOverlay
                    show={!loader.loaded[i] || loader.failed[i]}
                    onRetry={loader.failed[i] ? () => loader.retryOne(i) : undefined}
                  />
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>

        {images.length > 1 && (
          <>
            {/* Your custom Embla buttons */}
            <GalleryPrevButton onClick={() => api?.scrollPrev()} />
            <GalleryNextButton onClick={() => api?.scrollNext()} />
          </>
        )}
      </Carousel>
    </div>
  );
}

export default MainStage;

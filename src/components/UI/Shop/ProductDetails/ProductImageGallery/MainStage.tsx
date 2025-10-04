// MainStage.tsx
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from '@/components/UI/primitives/carousel';
import { LoadingOverlay, type ImageListLoaderReturnType, prevent } from '.';
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
  return (
    <div className='rounded-[20px] w-[95%] h-full relative'>
      <Carousel
        className='w-full'
        opts={{ align: 'start', watchDrag: true, loop: true }}
        setApi={setApi}
      >
        <CarouselContent>
          {images.map((src, i) => (
            <CarouselItem key={i} className='basis-full'>
              <div
                className='relative size-full aspect-[16/18] md:aspect-[16/13] rounded-[20px] overflow-hidden cursor-zoom-in'
                onClick={() => setOpen(true)}
              >
                <Image
                  {...prevent}
                  priority={i === 0}
                  fetchPriority={i === 0 ? 'high' : 'low'}
                  className='size-full object-cover object-top'
                  fill
                  src={loader.srcWithRetry(src, i)}
                  alt={metaTitle || 'Product image'}
                  // Patched sizes: cap max width to 640px
                  sizes='(max-width: 412px) 375px, (max-width: 640px) 480px, (min-resolution: 2dppx) 60vw, (min-width: 1280px) 800px, 1200px'
                  quality={80}
                  onLoad={() => loader.markLoaded(i, src)}
                  onError={() => loader.markFailed(i)}
                />
                <LoadingOverlay
                  show={!loader.loaded[i] || loader.failed[i]}
                  onRetry={loader.failed[i] ? () => loader.retryOne(i) : undefined}
                />
              </div>
            </CarouselItem>
          ))}
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

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
                  fetchPriority='high'
                  priority={i === 0}
                  className='size-full object-cover object-top'
                  fill
                  src={loader.srcWithRetry(src, i)}
                  alt={metaTitle || 'Product image'}
                  sizes='(max-width: 640px) 100vw, (max-width: 1280px) 70vw, 1200px'
                  quality={90}
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

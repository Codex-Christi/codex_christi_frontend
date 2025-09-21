// ThumbsPanel.tsx
'use client';
import Image from 'next/image';
import { ImageListLoaderReturnType, LoadingOverlay, prevent, isCloudfrontUrl } from '.';

function ThumbsPanel({
  images,
  currentIndex,
  onSelect,
  metaTitle,
  loader,
}: {
  images: string[];
  currentIndex: number;
  onSelect: (i: number) => void;
  metaTitle?: string;
  loader: ImageListLoaderReturnType;
}) {
  return (
    <div className='grid gap-4 grid-cols-5 order-2 sm:grid-cols-1 sm:order-1 lg:grid-cols-5 xl:grid-cols-1 xl:order-1'>
      {images.map((image, index) => {
        const isCF = isCloudfrontUrl(image);
        const thumbUrl = isCF
          ? `${loader.srcWithRetry(image, index)}${image.includes('?') ? '&' : '?'}w=160&q=80`
          : loader.srcWithRetry(image, index);

        return (
          <button
            key={index}
            onClick={() => onSelect(index)}
            className={`rounded-[15px] sm:rounded-[20px] size-14 sm:size-20 border-2 cursor-pointer ${
              index === currentIndex ? 'border-white' : 'border-transparent'
            }`}
            aria-label={`Go to image ${index + 1}`}
            type='button'
          >
            <div className='relative h-full w-full'>
              <Image
                {...prevent}
                alt={metaTitle || 'Product image'}
                className='rounded-[20px] transition-all object-cover'
                src={thumbUrl}
                width={80}
                height={80}
                quality={80}
                onLoad={() => loader.markLoaded(index, image)}
                onError={() => loader.markFailed(index)}
                unoptimized={isCF} // bypass Next optimizer for slow / dynamic CloudFront origin
              />
              <LoadingOverlay
                show={!loader.loaded[index] || loader.failed[index]}
                onRetry={loader.failed[index] ? () => loader.retryOne(index) : undefined}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default ThumbsPanel;

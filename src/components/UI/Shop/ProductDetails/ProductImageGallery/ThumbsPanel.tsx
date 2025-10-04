// ThumbsPanel.tsx
import Image from 'next/image';
import { ImageListLoaderReturnType, LoadingOverlay, prevent } from '.';
import { useThumbBoxWidth } from './useThumbBoxWidth';

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
  const { ref, width } = useThumbBoxWidth(80);

  return (
    <div
      ref={ref}
      className='grid gap-4 grid-cols-5 order-2 sm:grid-cols-1 sm:order-1 lg:grid-cols-5 xl:grid-cols-1 xl:order-1'
    >
      {images.map((image, index) => (
        <button
          key={index}
          type='button'
          onClick={() => onSelect(index)}
          className={`rounded-[15px] sm:rounded-[20px] size-14 sm:size-20 border-2 cursor-pointer ${
            index === currentIndex ? 'border-white' : 'border-transparent'
          }`}
          aria-label={`Go to image ${index + 1}`}
        >
          <div className='relative h-full w-full'>
            <Image
              {...prevent}
              alt={metaTitle || 'Product image'}
              className='rounded-[20px] transition-all object-cover'
              src={loader.srcWithRetry(image, index)}
              width={width}
              height={width}
              // The sizes prop ensures the browser picks the correct variant
              sizes={`${width}px`}
              quality={75}
              loading='lazy'
              onLoad={() => loader.markLoaded(index, image)}
              onError={() => loader.markFailed(index)}
            />
            <LoadingOverlay
              show={!loader.loaded[index] || loader.failed[index]}
              onRetry={loader.failed[index] ? () => loader.retryOne(index) : undefined}
            />
          </div>
        </button>
      ))}
    </div>
  );
}

export default ThumbsPanel;

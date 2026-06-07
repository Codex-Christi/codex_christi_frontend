// ThumbsPanel.tsx
import Image from 'next/image';
import { ImageListLoaderReturnType, LoadingOverlay, imagePreventDefaults } from '.';

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
    <div
      className='grid gap-4 grid-cols-5 order-2 sm:grid-cols-1 sm:order-1 lg:grid-cols-5 xl:grid-cols-1 xl:order-1'
    >
      {images.map((image, index) => (
        <button
          key={index}
          type='button'
          onClick={() => onSelect(index)}
          className={`rounded-[18px] sm:rounded-[20px] size-16 sm:size-20 border-[2.5px] cursor-pointer ${
            index === currentIndex ? 'border-white shadow-md shadow-gray-300' : 'border-transparent'
          } `}
          aria-label={`Go to image ${index + 1}`}
        >
          <div className='relative h-full w-full'>
            <Image
              {...imagePreventDefaults}
              alt={metaTitle || 'Product image'}
              className='rounded-[20px] size-full transition-[filter,opacity,transform] !object-cover object-top bg-top'
              src={loader.srcWithRetry(image, index)}
              width={80}
              height={80}
              quality={50}
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

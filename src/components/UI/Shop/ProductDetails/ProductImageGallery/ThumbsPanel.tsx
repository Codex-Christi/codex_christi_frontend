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

  // clamp maximum thumbnail width considered for `sizes`
  const MAX_THUMB = 160; // choose a cap, e.g. 160px — browser won't pick variants larger than this
  const thumbSizeHint = `${Math.min(width, MAX_THUMB)}px`;
  const thumbSizeHintHighDPI = `${Math.min(width * 1.5, MAX_THUMB)}px`;

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
          className={`rounded-[18px] sm:rounded-[20px] size-16 sm:size-20 border-[2.5px] cursor-pointer ${
            index === currentIndex ? 'border-white shadow-md shadow-gray-300' : 'border-transparent'
          } `}
          aria-label={`Go to image ${index + 1}`}
        >
          <div className='relative h-full w-full'>
            <Image
              {...prevent}
              alt={metaTitle || 'Product image'}
              className='rounded-[20px] transition-all !object-cover w-full object-top bg-top'
              src={loader.srcWithRetry(image, index)}
              width={width}
              height={width}
              // Use the clamped thumbSizeHint here
              sizes={`(min-resolution: 2dppx) ${thumbSizeHintHighDPI}px, ${thumbSizeHint}`}
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

// ThumbsPanel.tsx
import Image from 'next/image';
import {
  type ImageListLoaderReturnType,
  LoadingOverlay,
  imagePreventDefaults,
} from './galleryShared';
import styles from '../ProductDetails.module.css';

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
      className='grid w-full min-w-0 grid-cols-5 gap-4 order-2 sm:w-auto sm:grid-cols-1 sm:order-1 lg:w-full lg:grid-cols-5 xl:w-auto xl:grid-cols-1 xl:order-1'
    >
      {images.map((image, index) => (
        <button
          key={index}
          type='button'
          onClick={() => onSelect(index)}
          className={`${styles.thumbButton} ${
            index === currentIndex ? styles.thumbButtonActive : ''
          }`}
          aria-label={`Go to image ${index + 1}`}
        >
          <div className='relative h-full w-full'>
            <Image
              {...imagePreventDefaults}
              alt={metaTitle || 'Product image'}
              className={styles.thumbImage}
              src={loader.srcWithRetry(image, index)}
              width={80}
              height={80}
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

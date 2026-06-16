// ProductImageGallery/index.tsx
'use client';

import { useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { ProductDetailsContext } from '..';
import { useCurrentVariant } from '../currentVariantStore';
import ThumbsPanel from './ThumbsPanel';
import ActionButtons from './ActionButtons';
import MainStage from './MainStage';
import { type CarouselApi } from '@/components/UI/primitives/carousel';
import { useLightboxHistory } from './useLightBoxHistory';
import { toMerchizeImageUrl } from '@/lib/merchizeStorefront/imageUrls';
import type { BasicProductInterface } from '@/lib/merchizeStorefront/productTypes';

const ProductLightbox = dynamic(() => import('./ProductLightbox'), { ssr: false });

export const imagePreventDefaults = {
  onContextMenu: (e: React.SyntheticEvent) => e.preventDefault(),
  onDragStart: (e: React.SyntheticEvent) => e.preventDefault(),
};

export function LoadingOverlay({ show, onRetry }: { show: boolean; onRetry?: () => void }) {
  if (!show) return null;
  return (
    <div className='absolute inset-0 z-10 grid place-items-center bg-black/30 backdrop-blur-sm'>
      <div className='flex flex-col items-center gap-3'>
        <div className='h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white' />
        {onRetry && (
          <span
            role='button'
            tabIndex={0}
            onClick={onRetry}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onRetry()}
            className='text-white/90 text-sm underline cursor-pointer'
          >
            Reload
          </span>
        )}
      </div>
    </div>
  );
}

function useImageListLoader(urls: string[]) {
  const [loaded, setLoaded] = useState<boolean[]>(() => urls.map(() => false));
  const [failed, setFailed] = useState<boolean[]>(() => urls.map(() => false));
  const [nonce, setNonce] = useState(0);
  const seenLoaded = useRef<Map<string, true>>(new Map());

  useEffect(() => {
    const loadedTimer = window.setTimeout(() => {
      setLoaded(urls.map((u) => seenLoaded.current.has(u)));
      setFailed(urls.map(() => false));
    }, 0);

    return () => window.clearTimeout(loadedTimer);
  }, [urls]);

  const markLoaded = (i: number, url?: string) => {
    if (url) seenLoaded.current.set(url, true);
    setLoaded((arr) => arr.map((v, idx) => (idx === i ? true : v)));
  };

  const markFailed = (i: number) => setFailed((arr) => arr.map((v, idx) => (idx === i ? true : v)));
  const retryAll = () => setNonce((n) => n + 1);
  const retryOne = (i: number) => setFailed((arr) => arr.map((v, idx) => (idx === i ? false : v)));

  const srcWithRetry = (src: string, i: number) =>
    failed[i] ? `${src}${src.includes('?') ? '&' : '?'}r=${nonce}` : src;

  const anyLoading = loaded.some((v, i) => !v && !failed[i]);
  const anyFailed = failed.some(Boolean);
  const allLoaded = loaded.every(Boolean) && !anyFailed;

  return {
    loaded,
    failed,
    anyLoading,
    anyFailed,
    allLoaded,
    markLoaded,
    markFailed,
    retryAll,
    retryOne,
    srcWithRetry,
  } as const;
}
export type ImageListLoaderReturnType = ReturnType<typeof useImageListLoader>;

type ProductImageGalleryProps = {
  productMetaData?: BasicProductInterface['data'];
  initialImageUrls?: string[];
};

export const ProductImageGallery: React.FC<ProductImageGalleryProps> = ({
  productMetaData,
  initialImageUrls,
}) => {
  const [currentItem, setCurrentItem] = useState(0);
  const [open, setOpen] = useState(false);
  const [api, setApi] = useState<CarouselApi | null>(null);

  // Back button support while fullscreen
  useLightboxHistory(open, () => setOpen(false));

  const { matchingVariant, setMatchingVariant } = useCurrentVariant((s) => s);
  const productDetailsContext = useContext(ProductDetailsContext);
  const metadata = productMetaData ?? productDetailsContext?.productMetaData;
  const stableInitialImageUrls = initialImageUrls ?? productDetailsContext?.initialImageUrls ?? [];

  const pathname = usePathname();

  // Build image URLs (unchanged from your template)
  const images = useMemo(() => {
    const image_uris = matchingVariant?.image_uris ?? [];
    if (image_uris.length > 0) {
      return image_uris.map((uri) => toMerchizeImageUrl(uri)).filter(Boolean);
    }

    return stableInitialImageUrls.length > 0
      ? stableInitialImageUrls
      : [toMerchizeImageUrl(metadata?.image)].filter(Boolean);
  }, [matchingVariant?.image_uris, metadata?.image, stableInitialImageUrls]);

  const loader = useImageListLoader(images);
  const imageKey = useMemo(() => images.join('|'), [images]);

  // Pre-measure natural sizes for Lightbox zoom only after the user opens it.
  const [dimsState, setDimsState] = useState<{
    imageKey: string;
    dims: Record<number, { w: number; h: number }>;
  }>({
    imageKey,
    dims: {},
  });

  useEffect(() => {
    if (!open) return;

    images.forEach((src, i) => {
      const img = new window.Image();
      img.onload = () =>
        setDimsState((prev) => {
          const currentDims = prev.imageKey === imageKey ? prev.dims : {};
          if (currentDims[i]) {
            return prev.imageKey === imageKey ? prev : { imageKey, dims: currentDims };
          }

          return {
            imageKey,
            dims: {
              ...currentDims,
              [i]: { w: img.naturalWidth, h: img.naturalHeight },
            },
          };
        });
      img.src = src;
    });
  }, [imageKey, images, open]);

  // URL-driven reset (unchanged)
  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      setCurrentItem(0);
      setMatchingVariant(null);
    }, 0);

    return () => window.clearTimeout(resetTimer);
  }, [pathname, setMatchingVariant]);

  // Embla -> React state
  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrentItem(api.selectedScrollSnap());
    api.on('select', onSelect);
    onSelect();
    return () => {
      api.off?.('select', onSelect);
    };
  }, [api]);

  const scrollTo = useCallback(
    (i: number) => {
      setCurrentItem(i);
      api?.scrollTo(i);
    },
    [api],
  );

  // Build slides with known width/height when available
  const slides = useMemo(() => {
    const activeDims = dimsState.imageKey === imageKey ? dimsState.dims : {};

    return images.map((src, i) =>
      activeDims[i] ? { src, width: activeDims[i].w, height: activeDims[i].h } : { src },
    );
  }, [dimsState, imageKey, images]);
  const safeCurrentItem = images.length === 1 ? 0 : currentItem;

  return (
    <div
      className='bg-[#4C3D3D3D] backdrop-blur-[10px] p-4 rounded-[20px] space-y-2 lg:p-8 flex flex-col gap-8 items-start sm:gap-12 sm:flex-row lg:flex-col-reverse xl:flex-row'
      id='mainGallery'
    >
      {/* Thumbnails */}
      <ThumbsPanel
        images={images}
        currentIndex={currentItem}
        onSelect={(i) => scrollTo(i)}
        metaTitle={metadata?.title}
        loader={loader}
      />

      {/* Main image + side actions */}
      <div className='flex items-start w-full h-full gap-4 sm:gap-8 sm:order-2'>
        <MainStage
          images={images}
          metaTitle={metadata?.title}
          setOpen={setOpen}
          api={api}
          setApi={(a) => setApi(a)}
          loader={loader}
        />
        <ActionButtons productTitle={metadata?.title ?? 'Product'} setOpen={setOpen} />
      </div>

      {/* Fullscreen Lightbox (no custom zoom UI) */}
      {open && (
        <ProductLightbox
          open={open}
          onClose={() => setOpen(false)}
          index={safeCurrentItem}
          slides={slides}
        />
      )}
    </div>
  );
};

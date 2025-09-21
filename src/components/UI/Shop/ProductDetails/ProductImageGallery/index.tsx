// ProductImageGallery.tsx
'use client';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import 'yet-another-react-lightbox/styles.css'; // REQUIRED for fullscreen overlay & z-index
import { usePathname, useSearchParams } from 'next/navigation';
import { useProductDetailsContext } from '..';
import { useCurrentVariant } from '../currentVariantStore';
import ThumbsPanel from './ThumbsPanel';
import ActionButtons from './ActionButtons';
import MainStage from './MainStage';
import { type CarouselApi } from '@/components/UI/primitives/carousel';
import { GalleryPrevButton } from '../GalleryPrevButton';
import { GalleryNextButton } from '../GalleryNextButton';
import { ControllerRef, Plugin } from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import { useLightboxHistory } from './useLightBoxHistory';

export type ImageListLoaderReturnType = ReturnType<typeof useImageListLoader>;

// Dynamically import Lightbox to avoid SSR hydration issues
const Lightbox = dynamic(() => import('yet-another-react-lightbox'), { ssr: false });

// ---- Helpers ----
export const prevent = {
  onContextMenu: (e: React.SyntheticEvent) => e.preventDefault(),
  onDragStart: (e: React.SyntheticEvent) => e.preventDefault(),
};

// Loading Overlay
export function LoadingOverlay({ show, onRetry }: { show: boolean; onRetry?: () => void }) {
  if (!show) return null;
  return (
    <div className='absolute inset-0 z-10 grid place-items-center bg-black/30 backdrop-blur-sm'>
      <div className='flex flex-col items-center gap-3'>
        <div className='h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white' />
        {onRetry && (
          <button onClick={onRetry} className='text-white/90 text-sm underline'>
            Reload
          </button>
        )}
      </div>
    </div>
  );
}

/** Lightweight CloudFront detector — exported so child components can decide to bypass Next optimizer */
export function isCloudfrontUrl(u?: string) {
  return !!u && u.includes('d2dytk4tvgwhb4.cloudfront.net');
}

function useImageListLoader(urls: string[]) {
  const [loaded, setLoaded] = useState<boolean[]>(() => urls.map(() => false));
  const [failed, setFailed] = useState<boolean[]>(() => urls.map(() => false));
  const [nonce, setNonce] = useState(0); // bump to force retry

  // Persist loaded-by-URL across resets so cached images don't "stick" loading
  const seenLoaded = useRef<Map<string, true>>(new Map());

  useEffect(() => {
    setLoaded(urls.map((u) => seenLoaded.current.has(u)));
    setFailed(urls.map(() => false));
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

// Build a responsive srcSet for each slide using your CloudFront URLs.
// Assumes your CDN honors a `?w=` query to resize; adjust if your transformer differs.
const RESPONSIVE_WIDTHS = [320, 640, 960, 1200, 1600, 2048, 2560, 3840] as const;
function buildSrcSet(src: string, naturalW?: number, naturalH?: number) {
  if (!naturalW || !naturalH) return undefined;
  return RESPONSIVE_WIDTHS.filter((w) => w <= naturalW).map((w) => ({
    src: `${src}${src.includes('?') ? '&' : '?'}w=${w}`,
    width: w,
    height: Math.max(1, Math.round((w * naturalH) / naturalW)),
  }));
}

// Main Product Image Gallery Component
export const ProductImageGallery: React.FC = () => {
  const [currentItem, setCurrentItem] = useState(0);
  const [open, setOpen] = useState(false);
  const [api, setApi] = useState<CarouselApi | null>(null);
  const controllerRef = useRef<ControllerRef>(null);

  // Custom History Hook for lightbox fullscrenn back navigation
  useLightboxHistory(open, () => setOpen(false));

  const { matchingVariant, setMatchingVariant } = useCurrentVariant((s) => s);
  const productDetailsContext = useProductDetailsContext();
  const metadata = productDetailsContext.productMetaData;

  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ---- Derive image URLs exactly like your original code ----
  const images = useMemo(() => {
    const image_uris = matchingVariant?.image_uris ?? [];
    const initialImagesURIArr = productDetailsContext.productVariants[0].image_uris;
    const initialImageURLs = initialImagesURIArr.map(
      (imgString) => `https://d2dytk4tvgwhb4.cloudfront.net/${imgString}`,
    );

    return image_uris && image_uris.length > 0
      ? image_uris.map((uri) => `https://d2dytk4tvgwhb4.cloudfront.net/${uri}`)
      : initialImageURLs;
  }, [matchingVariant?.image_uris, productDetailsContext.productVariants]);

  const loader = useImageListLoader(images);

  // ---- Precompute natural image sizes for Lightbox Zoom & responsive srcSet ----
  const [dims, setDims] = useState<Record<number, { w: number; h: number }>>({});
  useEffect(() => {
    setDims({});
    images.forEach((src, i) => {
      const img = new window.Image();
      img.onload = () =>
        setDims((d) => (d[i] ? d : { ...d, [i]: { w: img.naturalWidth, h: img.naturalHeight } }));
      // probe a reasonably large size so we get accurate natural dims without asking full 8k images
      const probe = isCloudfrontUrl(src)
        ? `${src}${src.includes('?') ? '&' : '?'}w=1600&q=80`
        : src;
      img.src = probe;
    });
  }, [images]);

  // ---- Keep URL-driven reset behavior ----
  useEffect(() => {
    setCurrentItem(0);
    setMatchingVariant(null);
  }, [pathname, searchParams, setMatchingVariant]);

  // Ensure index stays valid if only one image
  useEffect(() => {
    if (images.length === 1) setCurrentItem(0);
  }, [images.length]);

  // Sync Embla selection -> React state
  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrentItem(api.selectedScrollSnap());
    api.on('select', onSelect);
    onSelect();
    return () => {
      api.off('select', onSelect);
    };
  }, [api]);

  const scrollTo = useCallback(
    (i: number) => {
      setCurrentItem(i);
      api?.scrollTo(i);
    },
    [api],
  );

  // ---- Build slides with width/height and responsive srcSet so Zoom works and browser picks optimal file ----
  const slides = useMemo(
    () =>
      images.map((src, i) => {
        const wh = dims[i];
        return wh
          ? {
              src,
              width: wh.w,
              height: wh.h,
              srcSet: buildSrcSet(src, wh.w, wh.h),
            }
          : { src };
      }),
    [images, dims],
  );

  return (
    <div
      className='bg-[#4C3D3D3D] backdrop-blur-[10px] p-4 rounded-[20px] space-y-2 lg:p-8 flex flex-col gap-8 items-start
     sm:gap-12 sm:flex-row lg:flex-col-reverse xl:flex-row'
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

      {/* Main Image + controls */}
      <div className='flex items-start w-full h-full gap-4 sm:gap-8 sm:order-2'>
        <MainStage
          images={images}
          metaTitle={metadata?.title}
          setOpen={setOpen}
          api={api}
          setApi={(a) => setApi(a)}
          loader={loader}
        />

        {/* Action Buttons */}
        <ActionButtons setOpen={setOpen} />
      </div>

      {/* Fullscreen Lightbox */}
      {open && (
        <Lightbox
          open={open}
          close={() => setOpen(false)}
          index={currentItem}
          slides={slides}
          plugins={[Zoom as Plugin]}
          controller={{ ref: controllerRef }}
          carousel={{
            imageFit: 'contain',
            imageProps: {
              style: { maxWidth: '100vw', maxHeight: '100vh', width: '100vw', height: 'auto' },
            },
          }}
          styles={{
            container: {
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(30px) contrast(0.95)',
            },
          }}
          // Keep your custom prev/next; Zoom buttons come from plugin CSS
          render={{
            buttonPrev: () => <GalleryPrevButton onClick={() => controllerRef?.current?.prev()} />,
            buttonNext: () => <GalleryNextButton onClick={() => controllerRef?.current?.next()} />,
          }}
        />
      )}
    </div>
  );
};

export default ProductImageGallery;

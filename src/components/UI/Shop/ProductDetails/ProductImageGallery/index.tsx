'use client';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import 'yet-another-react-lightbox/styles.css';
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

// Loading Overlay (no <button> inside, to avoid button-in-button)
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
            className='text-white/90 text-sm underline cursor-pointer select-none'
          >
            Reload
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * IMPORTANT: We must not mutate the original CDN URL with ?w=... because your
 * CloudFront origin doesn’t serve transformed sizes, causing 404s.
 * For Lightbox+Zoom, we build a src/srcSet pointing to Next’s optimizer:
 *   /_next/image?url=<encoded-original>&w=<size>&q=<quality>
 * per official docs. This also makes Zoom behave properly.  [oai_citation:1‡Yet Another React Lightbox](https://yet-another-react-lightbox.com/examples/nextjs)
 */
const IMAGE_SIZES = [16, 32, 48, 64, 96, 128, 256, 384] as const;
const DEVICE_SIZES = [640, 750, 828, 1080, 1200, 1920, 2048, 3840] as const;

function nextImageUrl(src: string, size: number, q = 90) {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${size}&q=${q}`;
}

function buildLightboxSlide(src: string, naturalW: number, naturalH: number) {
  const allSizes = [...IMAGE_SIZES, ...DEVICE_SIZES];
  const srcSet = allSizes
    .filter((size) => size <= naturalW)
    .map((size) => ({
      src: nextImageUrl(src, size),
      width: size,
      height: Math.round((naturalH / naturalW) * size),
    }));

  // Use the largest allowed size for the base src
  const largest = Math.min(
    naturalW,
    [...DEVICE_SIZES].reverse().find((d) => d <= naturalW) ?? naturalW,
  );

  return {
    width: naturalW,
    height: naturalH,
    src: nextImageUrl(src, largest),
    srcSet,
  };
}

function useImageListLoader(urls: string[]) {
  const [loaded, setLoaded] = useState<boolean[]>(() => urls.map(() => false));
  const [failed, setFailed] = useState<boolean[]>(() => urls.map(() => false));
  const [nonce, setNonce] = useState(0);

  // Persist loaded-by-URL across resets so cached images don’t pop back to loading
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

  // For main/thumbnail views we still want cache-busting on *original* CDN URL,
  // not the Next optimizer path.
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

// Main Product Image Gallery Component
export const ProductImageGallery: React.FC = () => {
  const [currentItem, setCurrentItem] = useState(0);
  const [open, setOpen] = useState(false);
  const [api, setApi] = useState<CarouselApi | null>(null);
  const controllerRef = useRef<ControllerRef>(null);

  // Lightbox back-button history integration
  useLightboxHistory(open, () => setOpen(false));

  const { matchingVariant, setMatchingVariant } = useCurrentVariant((s) => s);
  const productDetailsContext = useProductDetailsContext();
  const metadata = productDetailsContext.productMetaData;

  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Derive image URLs (your exact logic, but support multiple defaults)
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

  // Precompute natural sizes for Lightbox slides (so Zoom knows dimensions)
  const [dims, setDims] = useState<Record<number, { w: number; h: number }>>({});
  useEffect(() => {
    setDims({});
    // Only in the browser
    if (typeof window === 'undefined') return;
    images.forEach((src, i) => {
      const img = new window.Image();
      img.onload = () =>
        setDims((d) => (d[i] ? d : { ...d, [i]: { w: img.naturalWidth, h: img.naturalHeight } }));
      img.src = src;
    });
  }, [images]);

  // URL-driven reset behavior (as in your template)
  useEffect(() => {
    setCurrentItem(0);
    setMatchingVariant(null);
  }, [pathname, searchParams, setMatchingVariant]);

  // Keep index sane if a single image
  useEffect(() => {
    if (images.length === 1) setCurrentItem(0);
  }, [images.length]);

  // Embla -> React state (typed, clean cleanup)
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

  // Build Lightbox slides using Next optimizer (per docs)
  const slides = useMemo(
    () =>
      images.map((src, i) => {
        const wh = dims[i];
        return wh ? buildLightboxSlide(src, wh.w, wh.h) : { src };
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
            // makes mobile truly full-bleed (no cropping with Zoom)
            imageFit: 'contain',
          }}
          styles={{
            container: {
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(30px) contrast(0.95)',
            },
          }}
          // Custom nav buttons; Zoom buttons come from plugin CSS
          render={{
            buttonPrev: () => <GalleryPrevButton onClick={() => controllerRef.current?.prev()} />,
            buttonNext: () => <GalleryNextButton onClick={() => controllerRef.current?.next()} />,
          }}
        />
      )}
    </div>
  );
};

'use client';
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import 'yet-another-react-lightbox/styles.css'; // REQUIRED for fullscreen overlay & z-index
import { usePathname, useSearchParams } from 'next/navigation';
import { useProductDetailsContext } from '.';
import { useCurrentVariant } from './currentVariantStore';
import useAuthStore from '@/stores/authStore';

// shadcn/ui carousel (Embla)
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/UI/primitives/carousel';
import { GalleryPrevButton } from './GalleryPrevButton';
import { GalleryNextButton } from './GalleryNextButton';
import { ControllerRef, Plugin } from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';

// Dynamically import Lightbox to avoid SSR hydration issues
const Lightbox = dynamic(() => import('yet-another-react-lightbox'), { ssr: false });

// ---- Helpers ----
const prevent = {
  onContextMenu: (e: React.SyntheticEvent) => e.preventDefault(),
  onDragStart: (e: React.SyntheticEvent) => e.preventDefault(),
};

// ===== Small modular pieces (kept local to this file) =====
function LoadingOverlay({ show, onRetry }: { show: boolean; onRetry?: () => void }) {
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
  loader: ReturnType<typeof useImageListLoader>;
}) {
  return (
    <div className='grid gap-4 grid-cols-5 order-2 sm:grid-cols-1 sm:order-1 lg:grid-cols-5 xl:grid-cols-1 xl:order-1'>
      {images.map((image, index) => (
        <button
          key={index}
          onClick={() => onSelect(index)}
          className={`rounded-[15px] sm:rounded-[20px] size-14 sm:size-20 border-2 cursor-pointer ${index === currentIndex ? 'border-white' : 'border-transparent'}`}
          aria-label={`Go to image ${index + 1}`}
        >
          <div className='relative h-full w-full'>
            <Image
              {...prevent}
              alt={metaTitle || 'Product image'}
              className='rounded-[20px] transition-all object-cover'
              src={loader.srcWithRetry(image, index)}
              width={80}
              height={80}
              quality={100}
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
  loader: ReturnType<typeof useImageListLoader>;
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
                  className='size-full object-cover object-top'
                  fill
                  src={loader.srcWithRetry(src, i)}
                  alt={metaTitle || 'Product image'}
                  sizes='(max-width: 640px) 100vw, (max-width: 1280px) 70vw, 800px'
                  quality={100}
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
            {/* Your custom Embla buttons */}
            <GalleryPrevButton onClick={() => api?.scrollPrev()} />
            <GalleryNextButton onClick={() => api?.scrollNext()} />
          </>
        )}
      </Carousel>
    </div>
  );
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

export const ProductImageGallery: React.FC = () => {
  const [currentItem, setCurrentItem] = useState(0);
  const [open, setOpen] = useState(false);
  const [api, setApi] = useState<CarouselApi | null>(null);
  const controllerRef = useRef<ControllerRef>(null);

  const { matchingVariant, setMatchingVariant } = useCurrentVariant((s) => s);
  const productDetailsContext = useProductDetailsContext();
  const metadata = productDetailsContext.productMetaData;

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // ---- Derive image URLs exactly like your original code ----
  const images = useMemo(() => {
    const image_uris = matchingVariant?.image_uris ?? [];
    const firstImage = productDetailsContext.productVariants[0].image_uris[0];
    const firstImageUrl = `https://d2dytk4tvgwhb4.cloudfront.net/${firstImage}`;

    return image_uris && image_uris.length > 0
      ? image_uris.map((uri) => `https://d2dytk4tvgwhb4.cloudfront.net/${uri}`)
      : [firstImageUrl];
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
      img.src = src;
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
    <div className='bg-[#4C3D3D3D] backdrop-blur-[10px] p-4 rounded-[20px] space-y-2 lg:p-8 flex flex-col gap-8 items-start sm:gap-12 sm:flex-row lg:flex-col-reverse xl:flex-row'>
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

        {/* Action buttons (share / wishlist / inspect) */}
        <div className='grid gap-8'>
          <button aria-label='Open fullscreen' onClick={() => setOpen(true)}>
            <svg width='26' height='26' viewBox='0 0 26 26' fill='none'>
              <path
                d='M24.5801 1.03334C24.5272 1.01147 24.4711 1 24.4147 1H15.513C15.2736 1 15.0798 1.19375 15.0798 1.43318C15.0798 1.67261 15.2736 1.86636 15.513 1.86636H23.369L14.8378 10.3975C14.6686 10.5667 14.6686 10.8408 14.8378 11.0101C14.9225 11.0947 15.0333 11.137 15.1441 11.137C15.2549 11.137 15.3658 11.0947 15.4504 11.0101L23.9815 2.4789V10.1649C23.9815 10.4043 24.1753 10.598 24.4147 10.598C24.6542 10.598 24.8479 10.4043 24.8479 10.1649V1.43318C24.8479 1.37684 24.8364 1.32068 24.8146 1.2678C24.7707 1.16165 24.6863 1.07723 24.5801 1.03334Z'
                fill='white'
                stroke='white'
              />
              <path
                d='M1.28083 15.6287C1.0414 15.6287 0.847656 15.8224 0.847656 16.0618V24.5668C0.847656 24.6231 0.859131 24.6793 0.881022 24.7322C0.924885 24.8383 1.00933 24.9227 1.11538 24.9666C1.16831 24.9885 1.22447 24.9999 1.28083 24.9999H10.2393C10.4787 24.9999 10.6724 24.8062 10.6724 24.5668C10.6724 24.3273 10.4787 24.1336 10.2393 24.1336H2.32655L10.9427 15.5174C11.112 15.3482 11.112 15.0741 10.9427 14.9049C10.7735 14.7357 10.4994 14.7357 10.3302 14.9049L1.71401 23.521V16.0618C1.71401 15.8224 1.52027 15.6287 1.28083 15.6287Z'
                fill='white'
                stroke='white'
              />
            </svg>
          </button>

          {isAuthenticated && (
            <Link href=''>
              <svg width='30' height='26' viewBox='0 0 30 26' fill='none'>
                <path
                  d='M15.8468 24.41C15.4671 24.7464 14.8958 24.7453 14.5175 24.4075L13.2477 23.2736C6.38099 17.1657 1.84766 13.1373 1.84766 8.19346C1.84766 4.16512 5.07432 1 9.18099 1C11.1006 1 12.9564 1.72531 14.363 2.92401C14.8259 3.31848 15.5361 3.31848 15.999 2.92402C17.4056 1.72531 19.2614 1 21.181 1C25.2877 1 28.5143 4.16512 28.5143 8.19346C28.5143 13.1373 23.981 17.1657 17.1143 23.2866L15.8468 24.41Z'
                  stroke='white'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              </svg>
            </Link>
          )}

          <Link href=''>
            <svg width='22' height='26' viewBox='0 0 22 26' fill='none'>
              <path
                fillRule='evenodd'
                clipRule='evenodd'
                d='M20.6682 21.9967C20.6147 20.4055 19.295 19.1537 17.7084 19.1896C16.1218 19.2253 14.8593 20.5351 14.8771 22.1271C14.8951 23.7189 16.1866 25.0001 17.7735 25.0001C19.3993 24.9717 20.6949 23.6276 20.6682 21.9967Z'
                stroke='white'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
              <path
                fillRule='evenodd'
                clipRule='evenodd'
                d='M10.5341 12.9862C10.574 15.4334 8.62967 17.45 6.19032 17.4913C3.75163 17.4491 1.80825 15.4327 1.84826 12.9862C1.80825 10.5399 3.75163 8.52351 6.19032 8.4812C8.62967 8.52256 10.574 10.5392 10.5341 12.9862Z'
                stroke='white'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
              <path
                fillRule='evenodd'
                clipRule='evenodd'
                d='M19.2197 3.97618C19.2452 5.03077 18.6989 6.01641 17.7925 6.55124C16.8862 7.08607 15.762 7.08607 14.8556 6.55124C13.9492 6.01641 13.4029 5.03077 13.4286 3.97618C13.4029 2.92159 13.9492 1.93597 14.8556 1.40112C15.762 0.866293 16.8862 0.866293 17.7925 1.40112C18.6989 1.93597 19.2452 2.92159 19.2197 3.97618Z'
                stroke='white'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
              <line
                x1='9.14055'
                y1='9.79228'
                x2='13.6136'
                y2='5.31922'
                stroke='white'
                strokeWidth='2'
              />
              <path d='M9.80273 15.4656L15.5117 20.2808' stroke='white' strokeWidth='2' />
            </svg>
          </Link>
        </div>
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

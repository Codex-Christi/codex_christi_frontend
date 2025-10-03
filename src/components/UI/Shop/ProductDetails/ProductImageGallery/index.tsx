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
import type { ZoomRef } from 'yet-another-react-lightbox';
import { useLightboxHistory } from './useLightBoxHistory';
import { FaSearchMinus, FaSearchPlus } from 'react-icons/fa';

const Lightbox = dynamic(() => import('yet-another-react-lightbox'), { ssr: false });

export const prevent = {
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
export type ImageListLoaderReturnType = ReturnType<typeof useImageListLoader>;

export const ProductImageGallery: React.FC = () => {
  const [currentItem, setCurrentItem] = useState(0);
  const [open, setOpen] = useState(false);
  const [api, setApi] = useState<CarouselApi | null>(null);
  const controllerRef = useRef<ControllerRef>(null);
  const zoomRef = useRef<ZoomRef | null>(null);

  useLightboxHistory(open, () => setOpen(false));

  const { matchingVariant, setMatchingVariant } = useCurrentVariant((s) => s);
  const productDetailsContext = useProductDetailsContext();
  const metadata = productDetailsContext.productMetaData;

  const pathname = usePathname();
  const searchParams = useSearchParams();

  const images = useMemo(() => {
    const image_uris = matchingVariant?.image_uris ?? [];
    const initialImagesURIArr = productDetailsContext.productVariants[0].image_uris;
    const initialImageURLs = initialImagesURIArr.map(
      (img) => `https://d2dytk4tvgwhb4.cloudfront.net/${img}`,
    );
    return image_uris && image_uris.length > 0
      ? image_uris.map((uri) => `https://d2dytk4tvgwhb4.cloudfront.net/${uri}`)
      : initialImageURLs;
  }, [matchingVariant?.image_uris, productDetailsContext.productVariants]);

  const loader = useImageListLoader(images);

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

  useEffect(() => {
    setCurrentItem(0);
    setMatchingVariant(null);
  }, [pathname, searchParams, setMatchingVariant]);

  useEffect(() => {
    if (images.length === 1) setCurrentItem(0);
  }, [images.length]);

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

  const slides = useMemo(
    () =>
      images.map((src, i) => (dims[i] ? { src, width: dims[i].w, height: dims[i].h } : { src })),
    [images, dims],
  );

  return (
    <div
      className='bg-[#4C3D3D3D] backdrop-blur-[10px] p-4 rounded-[20px] space-y-2 lg:p-8 flex flex-col gap-8 items-start sm:gap-12 sm:flex-row lg:flex-col-reverse xl:flex-row'
      id='mainGallery'
    >
      <ThumbsPanel
        images={images}
        currentIndex={currentItem}
        onSelect={(i) => scrollTo(i)}
        metaTitle={metadata?.title}
        loader={loader}
      />

      <div className='flex items-start w-full h-full gap-4 sm:gap-8 sm:order-2'>
        <MainStage
          images={images}
          metaTitle={metadata?.title}
          setOpen={setOpen}
          api={api}
          setApi={(a) => setApi(a)}
          loader={loader}
        />
        <ActionButtons setOpen={setOpen} />
      </div>

      {open && (
        <Lightbox
          open={open}
          close={() => setOpen(false)}
          index={currentItem}
          slides={slides}
          plugins={[Zoom as Plugin]}
          controller={{ ref: controllerRef }}
          zoom={{ ref: zoomRef }}
          carousel={{
            imageFit: 'contain',
            imageProps: {
              style: {
                maxWidth: '100vw',
                maxHeight: '100vh',
                width: '100vw',
                height: 'auto',
              },
            },
          }}
          styles={{
            container: {
              backgroundColor: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(30px) contrast(0.95)',
            },
            slide: { display: 'grid', placeItems: 'center' },
          }}
          render={{
            buttonPrev: () => <GalleryPrevButton onClick={() => controllerRef.current?.prev()} />,
            buttonNext: () => <GalleryNextButton onClick={() => controllerRef.current?.next()} />,
            buttonZoom: () => (
              <div className='flex items-center gap-3 px-2'>
                <button
                  type='button'
                  className='yarl__button'
                  onClick={() => zoomRef.current?.zoomOut?.()}
                  aria-label='Zoom out'
                >
                  <FaSearchMinus size={24} /> {/* icon for zoom out */}
                </button>
                <button
                  type='button'
                  className='yarl__button'
                  onClick={() => zoomRef.current?.zoomIn?.()}
                  aria-label='Zoom in'
                >
                  <FaSearchPlus size={24} /> {/* icon for zoom in */}
                </button>
              </div>
            ),
          }}
        />
      )}
    </div>
  );
};

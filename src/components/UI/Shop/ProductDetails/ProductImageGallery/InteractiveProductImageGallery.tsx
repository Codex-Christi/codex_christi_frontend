'use client';

import { useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { ProductDetailsContext } from '..';
import { useCurrentVariant } from '../currentVariantStore';
import ThumbsPanel from './ThumbsPanel';
import ActionButtons from './ActionButtons';
import MainStage from './MainStage';
import { type CarouselApi } from '@/components/UI/primitives/carousel';
import { useLightboxHistory } from './useLightBoxHistory';
import type { BasicProductInterface } from '@/lib/merchizeStorefront/productTypes';
import { getVariantGalleryImageUrls, resolveProductGalleryImages } from './galleryImageUrls';
import styles from '../ProductDetails.module.css';

const ProductLightbox = dynamic(() => import('./ProductLightbox'), { ssr: false });

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
type ProductImageGalleryProps = {
  productMetaData?: BasicProductInterface['data'];
  initialImageUrls?: string[];
  initialOpen?: boolean;
};

const EMPTY_IMAGE_URLS: string[] = [];

export const InteractiveProductImageGallery: React.FC<ProductImageGalleryProps> = ({
  productMetaData,
  initialImageUrls,
  initialOpen = false,
}) => {
  const [currentItem, setCurrentItem] = useState(0);
  const [open, setOpen] = useState(initialOpen);
  const [api, setApi] = useState<CarouselApi | null>(null);

  // Back button support while fullscreen
  useLightboxHistory(open, () => setOpen(false));

  const matchingVariant = useCurrentVariant((s) => s.matchingVariant);
  const productDetailsContext = useContext(ProductDetailsContext);
  const metadata = productMetaData ?? productDetailsContext?.productMetaData;
  const productVariants = productDetailsContext?.productVariants;
  const stableInitialImageUrls = useMemo(
    () => initialImageUrls ?? productDetailsContext?.initialImageUrls ?? EMPTY_IMAGE_URLS,
    [initialImageUrls, productDetailsContext?.initialImageUrls],
  );

  const images = useMemo(() => {
    const selectedVariantImages = getVariantGalleryImageUrls(matchingVariant);
    if (selectedVariantImages.length > 0) return selectedVariantImages;

    return resolveProductGalleryImages({
      metadata,
      initialImageUrls: stableInitialImageUrls,
      variants: productVariants,
    });
  }, [matchingVariant, metadata, productVariants, stableInitialImageUrls]);

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
    <div className={styles.galleryPanel} id='mainGallery'>
      {/* Thumbnails */}
      <ThumbsPanel
        images={images}
        currentIndex={currentItem}
        onSelect={(i) => scrollTo(i)}
        metaTitle={metadata?.title}
        loader={loader}
      />

      {/* Main image + side actions */}
      <div className={styles.galleryMainColumn}>
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

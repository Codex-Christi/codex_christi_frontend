'use client';

import { useRef } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import type { ControllerRef } from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import { GalleryPrevButton } from '../GalleryPrevButton';
import { GalleryNextButton } from '../GalleryNextButton';

type ProductLightboxSlide = {
  src: string;
  width?: number;
  height?: number;
};

type ProductLightboxProps = {
  open: boolean;
  index: number;
  slides: ProductLightboxSlide[];
  onClose: () => void;
};

export default function ProductLightbox({ open, index, slides, onClose }: ProductLightboxProps) {
  const controllerRef = useRef<ControllerRef>(null);

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={index}
      slides={slides}
      plugins={[Zoom]}
      controller={{ ref: controllerRef }}
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
      }}
    />
  );
}

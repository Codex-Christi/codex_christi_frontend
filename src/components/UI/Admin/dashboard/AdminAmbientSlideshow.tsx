'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import CometsContainer from '@/components/UI/general/CometsContainer';
import { cn } from '@/lib/utils';
import styles from './AdminAmbientSlideshow.module.css';

type AmbientSlide = {
  id: string;
  position: string;
};

type AmbientSlideStyle = CSSProperties & {
  '--admin-ambient-crossfade-duration': string;
  '--admin-ambient-image-desktop': string;
  '--admin-ambient-image-mobile': string;
  '--admin-ambient-image-tablet': string;
  '--admin-ambient-position': string;
};

type AmbientSlideState = {
  activeIndex: number;
  previousIndex: number | null;
};

const ambientSlides: AmbientSlide[] = [
  {
    id: 'ambient-01',
    position: 'center',
  },
  {
    id: 'ambient-02',
    position: 'center',
  },
  {
    id: 'ambient-03',
    position: 'center',
  },
  {
    id: 'ambient-04',
    position: 'center',
  },
  {
    id: 'ambient-05',
    position: 'center',
  },
];

const ambientSlideDwellMs = 18000;
const ambientCrossFadeMs = 4200;
const ambientCrossFadeCleanupMs = ambientCrossFadeMs + 100;
const ambientCrossFadeDuration = `${ambientCrossFadeMs}ms`;

export default function AdminAmbientSlideshow() {
  const reducedMotion = usePrefersReducedAmbientMotion();
  const pageVisible = usePageVisible();
  const [slideState, setSlideState] = useState<AmbientSlideState>({
    activeIndex: 0,
    previousIndex: null,
  });
  const visibleSlideIndexes = useMemo(() => {
    if (
      reducedMotion ||
      slideState.previousIndex === null ||
      slideState.previousIndex === slideState.activeIndex
    ) {
      return [slideState.activeIndex];
    }

    return [slideState.previousIndex, slideState.activeIndex];
  }, [reducedMotion, slideState.activeIndex, slideState.previousIndex]);

  useEffect(() => {
    if (reducedMotion || !pageVisible || ambientSlides.length < 2) return;

    const intervalID = window.setInterval(() => {
      setSlideState(({ activeIndex }) => ({
        activeIndex: (activeIndex + 1) % ambientSlides.length,
        previousIndex: activeIndex,
      }));
    }, ambientSlideDwellMs);

    return () => window.clearInterval(intervalID);
  }, [pageVisible, reducedMotion]);

  useEffect(() => {
    if (slideState.previousIndex === null) return;

    const previousIndex = slideState.previousIndex;
    const timeoutID = window.setTimeout(() => {
      setSlideState((current) =>
        current.previousIndex === previousIndex ? { ...current, previousIndex: null } : current,
      );
    }, ambientCrossFadeCleanupMs);

    return () => window.clearTimeout(timeoutID);
  }, [slideState.previousIndex]);

  return (
    <div className={styles.slideshow} data-admin-ambient-slideshow aria-hidden='true'>
      {visibleSlideIndexes.map((slideIndex) => {
        const slide = ambientSlides[slideIndex];
        const isActive = slideIndex === slideState.activeIndex;

        return (
          <span
            key={slide.id}
            className={cn(styles.slide, isActive ? styles.slideVisible : styles.slideExiting)}
            data-admin-ambient-slide
            style={getAmbientSlideStyle(slide)}
          />
        );
      })}
      <div className={styles.imageTone} data-admin-ambient-image-tone />
      <CometsContainer
        variant='overlay'
        className={styles.comets}
        cometClassName={styles.cometField}
      />
      <div className={styles.foregroundVeil} data-admin-ambient-foreground-veil />
    </div>
  );
}

function getAmbientSlideStyle(slide: AmbientSlide): AmbientSlideStyle {
  return {
    '--admin-ambient-crossfade-duration': ambientCrossFadeDuration,
    '--admin-ambient-image-desktop': `url("${getAmbientImageSrc(slide.id, 'desktop')}")`,
    '--admin-ambient-image-mobile': `url("${getAmbientImageSrc(slide.id, 'mobile')}")`,
    '--admin-ambient-image-tablet': `url("${getAmbientImageSrc(slide.id, 'tablet')}")`,
    '--admin-ambient-position': slide.position,
  };
}

function getAmbientImageSrc(id: AmbientSlide['id'], variant: 'desktop' | 'mobile' | 'tablet') {
  return `/media/img/admin/ambient/${id}-${variant}.avif`;
}

function usePrefersReducedAmbientMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const transparencyQuery = window.matchMedia('(prefers-reduced-transparency: reduce)');
    const updateReducedMotion = () => {
      setReducedMotion(motionQuery.matches || transparencyQuery.matches);
    };

    updateReducedMotion();
    motionQuery.addEventListener('change', updateReducedMotion);
    transparencyQuery.addEventListener('change', updateReducedMotion);

    return () => {
      motionQuery.removeEventListener('change', updateReducedMotion);
      transparencyQuery.removeEventListener('change', updateReducedMotion);
    };
  }, []);

  return reducedMotion;
}

function usePageVisible() {
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const updatePageVisible = () => {
      setPageVisible(document.visibilityState !== 'hidden');
    };

    updatePageVisible();
    document.addEventListener('visibilitychange', updatePageVisible);

    return () => document.removeEventListener('visibilitychange', updatePageVisible);
  }, []);

  return pageVisible;
}

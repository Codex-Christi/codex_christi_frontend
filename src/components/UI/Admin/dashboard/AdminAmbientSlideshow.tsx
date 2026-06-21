import type { CSSProperties } from 'react';
import styles from './AdminAmbientSlideshow.module.css';

type AmbientSlide = {
  id: string;
  position: string;
};

type AmbientSlideStyle = CSSProperties & {
  '--admin-ambient-duration': string;
  '--admin-ambient-delay': string;
};

type AmbientImageStyle = CSSProperties & {
  '--admin-ambient-position': string;
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

const secondsPerSlide = 10;

export default function AdminAmbientSlideshow() {
  const durationSeconds = ambientSlides.length * secondsPerSlide;

  return (
    <div
      className={styles.slideshow}
      data-admin-ambient-slideshow
      aria-hidden='true'
    >
      {ambientSlides.map((slide, index) => (
        <span
          key={slide.id}
          className={styles.slide}
          data-admin-ambient-slide
          style={getAmbientSlideStyle(slide, index, durationSeconds)}
        >
          <picture className={styles.picture}>
            <source
              media='(max-width: 640px)'
              srcSet={getAmbientImageSrc(slide.id, 'mobile')}
            />
            <source
              media='(max-width: 1180px)'
              srcSet={getAmbientImageSrc(slide.id, 'tablet')}
            />
            <img
              className={styles.image}
              src={getAmbientImageSrc(slide.id, 'desktop')}
              alt=''
              decoding='async'
              fetchPriority={index === 0 ? 'high' : 'low'}
              loading={index === 0 ? 'eager' : 'lazy'}
              style={getAmbientImageStyle(slide)}
            />
          </picture>
        </span>
      ))}
      <div className={styles.scrim} data-admin-ambient-scrim />
    </div>
  );
}

function getAmbientSlideStyle(
  slide: AmbientSlide,
  index: number,
  durationSeconds: number,
): AmbientSlideStyle {
  return {
    '--admin-ambient-duration': `${durationSeconds}s`,
    '--admin-ambient-delay': `${index * secondsPerSlide}s`,
  };
}

function getAmbientImageStyle(slide: AmbientSlide): AmbientImageStyle {
  return {
    '--admin-ambient-position': slide.position,
  };
}

function getAmbientImageSrc(
  id: AmbientSlide['id'],
  variant: 'desktop' | 'mobile' | 'tablet',
) {
  return `/media/img/admin/ambient/${id}-${variant}.avif`;
}

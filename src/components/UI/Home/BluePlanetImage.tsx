import type { ImgHTMLAttributes } from 'react';

type BluePlanetImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'>;

export default function BluePlanetImage({
  alt = 'Blue Planet',
  width = 634,
  height = 296,
  decoding = 'async',
  loading = 'lazy',
  ...props
}: BluePlanetImageProps) {
  return (
    <picture>
      <source srcSet='/media/img/home/blue-planet.avif' type='image/avif' />
      <source srcSet='/media/img/home/blue-planet.webp' type='image/webp' />
      <source srcSet='/media/img/home/blue-planet.png' type='image/png' />
      <img
        {...props}
        alt={alt}
        decoding={decoding}
        height={height}
        loading={loading}
        src='/media/img/home/blue-planet.svg'
        width={width}
      />
    </picture>
  );
}

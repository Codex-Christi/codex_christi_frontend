'use client';

import dynamic from 'next/dynamic';
import type { ImageProps } from 'next/image';
import { useAfterInitialPageLoad } from '@/lib/hooks/useAfterInitialPageLoad';

type ShopProfileAvatarProps = Omit<ImageProps, 'src'> & {
  width: number;
  height: number;
};

const HydratedShopProfileAvatar = dynamic(() => import('./ShopProfileAvatarHydrated'), {
  ssr: false,
});

function ShopProfileAvatarPlaceholder({
  width,
  height,
  alt,
  className,
}: Pick<ShopProfileAvatarProps, 'width' | 'height' | 'alt' | 'className'>) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground ${className ?? ''}`}
      style={{ width, height }}
      role='img'
      aria-label={typeof alt === 'string' ? alt : 'User avatar'}
    >
      <svg
        aria-hidden='true'
        className='size-[58%]'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeLinecap='round'
        strokeLinejoin='round'
        strokeWidth='1.75'
      >
        <path d='M20 21a8 8 0 0 0-16 0' />
        <circle cx='12' cy='7' r='4' />
      </svg>
    </span>
  );
}

export default function ShopProfileAvatar(props: ShopProfileAvatarProps) {
  const ready = useAfterInitialPageLoad(2400);

  return (
    <span
      className='inline-flex items-center justify-center'
      style={{ width: props.width, height: props.height }}
    >
      {ready ? (
        <HydratedShopProfileAvatar {...props} />
      ) : (
        <ShopProfileAvatarPlaceholder {...props} />
      )}
    </span>
  );
}

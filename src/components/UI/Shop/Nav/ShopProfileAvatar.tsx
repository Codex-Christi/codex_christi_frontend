'use client';

import { useEffect, useState, type ComponentType } from 'react';
import type { ImageProps } from 'next/image';
import { useDeferredClientEnhancement } from '@/lib/hooks/useDeferredClientEnhancement';

type ShopProfileAvatarProps = Omit<ImageProps, 'src'> & {
  width: number;
  height: number;
};

type HydratedShopProfileAvatarComponent = ComponentType<ShopProfileAvatarProps>;

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
  const { ready, requestReady } = useDeferredClientEnhancement({
    fallbackDelay: 12000,
  });
  const [HydratedAvatar, setHydratedAvatar] =
    useState<HydratedShopProfileAvatarComponent | null>(null);

  useEffect(() => {
    if (!ready || HydratedAvatar) return;

    let cancelled = false;

    void import('./ShopProfileAvatarHydrated').then((module) => {
      if (!cancelled) setHydratedAvatar(() => module.default);
    });

    return () => {
      cancelled = true;
    };
  }, [HydratedAvatar, ready]);

  return (
    <span
      className='inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full'
      style={{ width: props.width, height: props.height }}
      onPointerMove={requestReady}
    >
      {HydratedAvatar ? (
        <HydratedAvatar {...props} />
      ) : (
        <ShopProfileAvatarPlaceholder {...props} />
      )}
    </span>
  );
}

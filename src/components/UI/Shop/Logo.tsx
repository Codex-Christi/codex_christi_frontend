'use client';

import { MouseEvent } from 'react';
import CustomShopLink from './HelperComponents/CustomShopLink';

export default function Logo() {
  // Main JSX
  return (
    <CustomShopLink
      redirectToParentSite={false}
      href='/'
      className='inline-block'
    >
      <picture>
        <source srcSet='/media/img/shop/shop-logo-216.avif' type='image/avif' />
        <source srcSet='/media/img/shop/shop-logo-216.webp' type='image/webp' />
        <img
          width={72}
          height={48}
          className='relative block pointer-events-auto !max-w-[unset]'
          style={{ width: '72px', height: 'auto' }}
          alt='Codex Christi Main Logo'
          decoding='sync'
          fetchPriority='high'
          loading='eager'
          src='/media/img/shop/shop-logo-1.svg'
          onContextMenu={(event: MouseEvent<HTMLImageElement>) => {
            event.preventDefault();
          }}
          onDragStart={(event: MouseEvent<HTMLImageElement>) => {
            event.preventDefault();
          }}
        />
      </picture>
    </CustomShopLink>
  );
}

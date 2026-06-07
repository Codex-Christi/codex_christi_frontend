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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        width={72}
        height={48}
        className='relative block pointer-events-auto !max-w-[unset]'
        style={{ width: '72px', height: 'auto' }}
        alt='Codex Christi Main Logo'
        src='/media/img/shop/shop-logo-1.svg'
        onContextMenu={(event: MouseEvent<HTMLImageElement>) => {
          event.preventDefault();
        }}
        onDragStart={(event: MouseEvent<HTMLImageElement>) => {
          event.preventDefault();
        }}
      />
    </CustomShopLink>
  );
}

'use client';

import { MouseEvent } from 'react';
import Image from 'next/image';
import CustomShopLink from './HelperComponents/CustomShopLink';

export default function Logo() {
  // Main JSX
  return (
    <CustomShopLink
      redirectToParentSite={false}
      href='/'
      className='inline-block'
    >
      <Image
        priority={true}
        width={72}
        height={48.375}
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

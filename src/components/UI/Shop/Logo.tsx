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
        priority
        width={96}
        height={64.5}
        className={`h-auto relative`}
        alt='Codex Christi Main Logo'
        src='/media/img/shop/shop-logo.svg'
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

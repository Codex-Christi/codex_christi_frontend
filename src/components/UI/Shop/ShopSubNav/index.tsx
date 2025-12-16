'use client';

import React, { FC } from 'react';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import { useResponsiveSSRValue } from '@/lib/hooks/useResponsiveSSR_Store';
import { categories, helperLinks } from './SubNavObj';
import { usePathname } from 'next/navigation';
import Divider from '../../general/Divider';

const SubNav = () => {
  // Hooks
  const { isMobileAndTablet, isDesktopOnly } = useResponsiveSSRValue();

  const pathname = usePathname();

  // jsx
  return (
    <nav
      aria-label={`Categories' Links`}
      role='navigation'
      className={`flex flex-col gap-7 w-full max-w-[220px] 
		${pathname === '/shop' ? 'bg-inherit' : 'lg:bg-[#3D3D3D4D]'} self-center py-2.5
        !overflow-y-auto  lg:!overflow-y-hidden
        lg:flex-row lg:items-center lg:justify-around lg:gap-[unset] lg:max-w-full lg:self-[unset]
       `}
    >
      {/* HelperLinks component for only  desktop */}
      {isDesktopOnly && <HelperLinksComponent />}
      {/* Vertical Divider for Desktop only */}
      {isDesktopOnly && <Divider vertical length='1.05rem' />}
      {/* Main Categories List for both mobile and Desktop */}
      <CategoriesComponent />
      {/* Horizontal Divider for Mobile devices only */}
      {isMobileAndTablet && <Divider horizontal />}
      {/* Helper Lsit Components for only Mobile devices */}
      {isMobileAndTablet && <HelperLinksComponent />}
    </nav>
  );
};

// Categories Component
const CategoriesComponent: FC = () => {
  // Hooks
  const { isMobileAndTablet } = useResponsiveSSRValue();

  return (
    <>
      {categories.map((obj, index) => {
        const { textValue, href, SvgElem, isCategoryHomePath } = obj;
        const ariaLabel = `Go to ${textValue} category`;
        return (
          <CustomShopLink
            key={textValue + index}
            href={isCategoryHomePath ? '/shop/categories/all' : `/shop/category${href}`}
            ariaLabel={ariaLabel}
            className='flex items-center gap-7 lg:gap-[unset]'
          >
            {isMobileAndTablet && <SvgElem className='!w-9 h-9' />}
            <h3 className='font-semibold text-lg'>{textValue}</h3>
          </CustomShopLink>
        );
      })}
    </>
  );
};

// Helkper Link like "Contact us, Track order, etc"
const HelperLinksComponent: FC = () => {
  const { isDesktopOnly } = useResponsiveSSRValue();
  return helperLinks.map((obj, index) => {
    const { textValue, href, SvgElem } = obj;
    const ariaLabel = `${textValue}`;
    return (
      !(isDesktopOnly && href === '/contact-us') && (
        <CustomShopLink
          key={textValue + index}
          href={`/shop${href}`}
          ariaLabel={ariaLabel}
          className='flex items-center gap-7 lg:gap-[unset]'
        >
          {<SvgElem className='!w-9 h-9 lg:w-5 lg:h-5' />}
          <h3 className='font-semibold text-lg text-[1.05rem]'>{textValue}</h3>
        </CustomShopLink>
      )
    );
  });
};

export default SubNav;

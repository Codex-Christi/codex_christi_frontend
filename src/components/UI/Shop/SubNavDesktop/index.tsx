import React, { FC } from 'react';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import { useResponsiveSSRValue } from '@/lib/hooks/useResponsiveSSR_Store';
import { categories, helperLinks } from './SubNavObj';
import Divider from '../../general/Divider';

const SubNav = () => {
  // Hooks
  const { isMobileAndTablet, isDesktopOnly } = useResponsiveSSRValue();

  // jsx
  return (
    <div
      role='navigation'
      className={`bg-transparent flex flex-col gap-5
        lg:flex-row w-full lg:items-center lg:justify-around lg:gap-[unset] py-2.5 
        lg:shadow lg:shadow-gray-800`}
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
    </div>
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
            href={
              isCategoryHomePath
                ? '/shop/categories/all'
                : `/shop/category${href}`
            }
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
          href={`/shop/${href}`}
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

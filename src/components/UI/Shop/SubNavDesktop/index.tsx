import React from 'react';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import useResponsiveSSR from '@/lib/hooks/useResponsiveSSR';
import { categories, helperLinks } from './SubNavObj';

const SubNav = () => {
  // Hooks
  const { isMobileAndTablet, isDesktopOnly } = useResponsiveSSR();

  // jsx
  return (
    <div role='navigation' className='bg-transparent flex w-full '>
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
            className='flex items-center'
          >
            {isMobileAndTablet && <SvgElem className='!w-10 h-10' />}
            <h3 className='font-semibold text-lg'>{textValue}</h3>
          </CustomShopLink>
        );
      })}
      {helperLinks.map((obj, index) => {
        const { textValue, href, SvgElem } = obj;
        const ariaLabel = `${textValue}`;
        return (
          <>
            {!(isDesktopOnly && href === '/contact-us') && (
              <CustomShopLink
                key={textValue + index}
                href={`/shop/${href}`}
                ariaLabel={ariaLabel}
                className='flex items-center'
              >
                {<SvgElem className='!w-10 h-10 lg:w-5 lg:h-5' />}
                <h3 className='font-semibold text-lg'>{textValue}</h3>
              </CustomShopLink>
            )}
          </>
        );
      })}
    </div>
  );
};

export default SubNav;

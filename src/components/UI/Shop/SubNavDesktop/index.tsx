import React from 'react';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import useResponsiveSSR from '@/lib/hooks/useResponsiveSSR';
import { categories, helperLinks } from './SubNavObj';

const subNavLinks = { categories, helperLinks };

const SubNav = () => {
  // Hooks
  const { isMobileAndTablet } = useResponsiveSSR();

  // jsx
  return (
    <div role='navigation' className='bg-transparent flex w-full '>
      {subNavLinks.categories.map((obj, index) => {
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
    </div>
  );
};

export default SubNav;

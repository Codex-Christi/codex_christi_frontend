import React, { FC } from 'react';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import { categories, helperLinks } from './SubNavObj';
import Divider from '../../general/Divider';

const SubNav = () => {
  // jsx
  return (
    <nav
      aria-label={`Categories' Links`}
      role='navigation'
      className={`flex flex-col gap-7 w-full max-w-[220px] 
		lg:bg-[#3D3D3D4D] self-center py-2.5
        !overflow-y-auto  lg:!overflow-y-hidden
        lg:flex-row lg:items-center lg:justify-around lg:gap-[unset] lg:max-w-full lg:self-[unset]
       `}
    >
      {/* HelperLinks component for only  desktop */}
      <div className='hidden lg:contents'>
        <HelperLinksComponent hideDesktopContact />
      </div>
      {/* Vertical Divider for Desktop only */}
      <div className='hidden lg:block'>
        <Divider vertical length='1.05rem' />
      </div>
      {/* Main Categories List for both mobile and Desktop */}
      <CategoriesComponent />
      {/* Horizontal Divider for Mobile devices only */}
      <div className='lg:hidden w-full'>
        <Divider horizontal />
      </div>
      {/* Helper Lsit Components for only Mobile devices */}
      <div className='contents lg:hidden'>
        <HelperLinksComponent />
      </div>
    </nav>
  );
};

// Categories Component
const CategoriesComponent: FC = () => {
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
            <SvgElem className='!w-9 h-9 lg:hidden' />
            <h3 className='font-semibold text-lg'>{textValue}</h3>
          </CustomShopLink>
        );
      })}
    </>
  );
};

// Helkper Link like "Contact us, Track order, etc"
const HelperLinksComponent: FC<{ hideDesktopContact?: boolean }> = ({ hideDesktopContact }) => {
  return helperLinks.map((obj, index) => {
    const { textValue, href, SvgElem } = obj;
    const ariaLabel = `${textValue}`;
    return (
      !(hideDesktopContact && href === '/contact-us') && (
        <CustomShopLink
          key={textValue + index}
          href={`/shop${href}`}
          ariaLabel={ariaLabel}
          className='flex items-center gap-7 lg:gap-[unset]'
        >
          {<SvgElem className='!w-9 !h-9 lg:!w-5 lg:!h-5' />}
          <h3 className='font-semibold text-lg text-[1.05rem]'>{textValue}</h3>
        </CustomShopLink>
      )
    );
  });
};

export default SubNav;

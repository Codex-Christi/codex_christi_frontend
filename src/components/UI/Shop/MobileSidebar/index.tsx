'use client';

import { Dispatch, FC, ReactNode, SetStateAction } from 'react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
  DrawerOverlay,
} from '@/components/UI/primitives/drawer';
import { useResponsiveSSRValue } from '@/lib/hooks/useResponsiveSSR_Store';
import SubNav from '../ShopSubNav';
import { useRouteChangeAware } from '@/lib/hooks/useRouteChangeAware';
import { useAmIOnShopRoute } from '@/lib/hooks/shopHooks/useAmIOnShopRoute';
import { getDefaultISO3 } from '@/lib/utils/shop/geo/getDefaultISO3.client';
import dynamic from 'next/dynamic';

const CountryDropdown = dynamic(
  () => import('@/components/UI/Shop/Index/CountryDropDownClientFloating'),
);

// Interfaces
interface SideDrawerInterface {
  children?: ReactNode;
  openState: boolean;
  openCloseController: Dispatch<SetStateAction<boolean>>;
}

const ShopMobileSideBar: FC<SideDrawerInterface> = ({ openState, openCloseController }) => {
  // Hooks
  const { isDesktopOnly, isMobile } = useResponsiveSSRValue();
  useRouteChangeAware(() => {
    openCloseController(false);
  });
  const defaultISO3 = getDefaultISO3();
  const { youAreOnDesiredShopRoute: amIOnShopHome } = useAmIOnShopRoute('/shop');

  // Main JSX
  return (
    <>
      {!isDesktopOnly && (
        <Drawer direction='left' open={openState} onOpenChange={openCloseController}>
          <DrawerOverlay className={` bg-black/[0.01] !backdrop-blur-[2px]`}>
            <DrawerContent
              id='drawer-root'
              className={` !rounded-none min-h-[100svh] h-[100svh] bg-[#131313] bg-opacity-95  !border-none
                !fixed !bottom-0 !left-0 !z-[500] w-full max-w-[350px] overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]`}
            >
              <DrawerTitle className='!invisible'>
                <DrawerDescription>Mobile Navigation Sidebar</DrawerDescription>
              </DrawerTitle>

              <section className='flex justify-between'>
                <DrawerClose className='ml-16 mb-10 mt-2'>
                  <CloseButtonSVG className='w-7 h-7 ' />
                </DrawerClose>

                {!amIOnShopHome && isMobile && (
                  <CountryDropdown
                    popoverModal={isMobile} // default true; explicit if you want
                    trapInsideDrawer={isMobile}
                    mobileBlockAutoFocus={isMobile}
                    isMobileOverride={isMobile}
                    portalContainer={
                      typeof document !== 'undefined'
                        ? (document.querySelector('#drawer-root') as HTMLElement)
                        : null
                    }
                    initialIso3={defaultISO3}
                    slim
                    wrapperClassName='scale-[1.25] mr-5 !z-[999]'
                    chevronClassName='ml-2 shrink-0 opacity-100 size-[1.5rem] text-white' // wrapper-only bump
                    classNames={{
                      trigger: ` inline-flex items-center gap-2 h-12 px-3 rounded-full border border-white/20 bg-black/60 text-white whitespace-nowrap 
                  hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60`,
                      popover:
                        'w-[320px] p-0 !z-[1000] will-change-transform [transform:translateZ(0)]',
                    }}
                  />
                )}
              </section>

              {/* SubNav Container */}
              <div className='flex flex-col gap-7'>
                {/* 'Categories' text */}
                <h3 className='text-[1.2rem] ml-16'>Categories</h3>
                {/*  */}

                {/* Main SubNav Here */}
                <SubNav />
              </div>

              {/* {children} */}
            </DrawerContent>
          </DrawerOverlay>
        </Drawer>
      )}
    </>
  );
};

const CloseButtonSVG: FC<{ className?: string }> = (props) => {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='18.385'
      height='18.385'
      fill='none'
      viewBox='0 0 18.385 18.385'
      {...props}
    >
      <path
        fill='#FFF'
        fillRule='evenodd'
        d='M15.85 1.707A1 1 0 1 0 14.434.293L8.071 6.657l-4.95-4.95a1 1 0 0 0-1.414 1.414l4.95 4.95-6.364 6.364a1 1 0 1 0 1.414 1.414l6.364-6.364 7.778 7.779a1 1 0 0 0 1.415-1.415L9.485 8.071z'
      ></path>
    </svg>
  );
};

export default ShopMobileSideBar;

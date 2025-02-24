'use client';

import { FC, useState } from 'react';
import Logo from '../Logo';
import NavSearch from './NavSearch';
import { Button } from '../../primitives/button';
import NavTopRightLinks from './NavTopRightLinks';
import SubNav from '../ShopSubNav';
import { useResponsiveSSRValue } from '@/lib/hooks/useResponsiveSSR_Store';
import ShopMobileSideBar from '../MobileSidebar';
// import RouteWatcher from './RouteWatcher';

const ShopNav: FC = () => {
  // Hooks
  const { isDesktopOnly, isMobileAndTablet } = useResponsiveSSRValue();

  // State Values
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Main JSX
  return (
    <>
      <nav
        role='navigation'
        className={`!z-[99] relative pointer-events-auto bg-blue-700/40 backdrop-blur-[2px] flex justify-between
        items-center select-none
        px-2 py-[10px]
        md:px-[20px] md:py-[12px]
        lg:px-[24px] lg:py-[16px] `}
      >
        <section className='flex gap-5 md:gap-10'>
          {/* Button for Mobile Sidebar Hamburger */}
          <Button
            name='Toggle mobile sidebar'
            className='lg:!hidden scale-75 md:scale-90 !p-0 '
            variant='link'
            onClick={() => setIsSidebarOpen((prevSate) => !prevSate)}
          >
            <svg
              xmlns='http://www.w3.org/2000/svg'
              width='40'
              height='24.516'
              fill='none'
              viewBox='0 0 40 24.516'
            >
              <path
                id='Vector'
                fill='#FFF'
                fillRule='evenodd'
                d='M1.935 0a1.935 1.935 0 0 0 0 3.871h36.13a1.936 1.936 0 0 0 0-3.871zm0 10.323a1.936 1.936 0 0 0 0 3.87h30.968a1.935 1.935 0 1 0 0-3.87zm0 10.322a1.935 1.935 0 1 0 0 3.871H20a1.936 1.936 0 0 0 0-3.87z'
              ></path>
            </svg>
          </Button>

          {/* Main Shop site logo */}
          <Logo />
        </section>

        <NavSearch />

        <NavTopRightLinks />
      </nav>

      {isDesktopOnly && <SubNav />}

      {isMobileAndTablet && (
        <ShopMobileSideBar
          openState={isSidebarOpen}
          openCloseController={setIsSidebarOpen}
        />
      )}

      {/* <RouteWatcher stateSwitcher={setIsSidebarOpen} /> */}
    </>
  );
};

export default ShopNav;

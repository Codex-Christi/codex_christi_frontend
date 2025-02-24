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

// Interfaces
interface SideDrawerInterface {
  children?: ReactNode;
  openState: boolean;
  openCloseController: Dispatch<SetStateAction<boolean>>;
}

const ShopMobileSideBar: FC<SideDrawerInterface> = ({
  openState,
  openCloseController,
}) => {
  // Hooks
  const { isDesktopOnly } = useResponsiveSSRValue();

  // Main JSX
  return (
    <>
      {!isDesktopOnly && (
        <Drawer
          direction='left'
          open={openState}
          onOpenChange={openCloseController}
        >
          <DrawerOverlay className={` bg-black/[0.01] !backdrop-blur-[2px]`}>
            <DrawerContent
              className={` !rounded-none h-full bg-[#131313] bg-opacity-95  !border-none
                !fixed !bottom-0 !left-0 !z-[500] w-full max-w-[350px] overflow-y-auto`}
            >
              <DrawerTitle className='!invisible'>
                <DrawerDescription>Mobile Navigation Sidebar</DrawerDescription>
              </DrawerTitle>

              <DrawerClose className='ml-16 mb-10 mt-2'>
                <CloseButtonSVG className='w-7 h-7 ' />
              </DrawerClose>

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

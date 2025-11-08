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
import { BsCaretLeftFill } from 'react-icons/bs';
import { useResponsiveSSRValue } from '@/lib/hooks/useResponsiveSSR_Store';
import NavList from './NavList';

// Interfaces
interface SideDrawerInterface {
  children?: ReactNode;
  openState: boolean;
  openCloseController: Dispatch<SetStateAction<boolean>>;
}

const SideDrawer: FC<SideDrawerInterface> = ({ openState, openCloseController }) => {
  // Hooks
  const { isDesktopOnly } = useResponsiveSSRValue();

  // Main JSX
  return (
    <>
      {!isDesktopOnly && (
        <Drawer direction='right' open={openState} onOpenChange={openCloseController}>
          <DrawerOverlay className={` bg-black/[0.01] !backdrop-blur-[10px]`}>
            <DrawerContent
              className={` !rounded-none h-full bg-black/80  !border-none
                !fixed !bottom-0 !right-0 !z-[500] w-full ml-auto !max-w-[600px] after:!hidden`}
            >
              <DrawerTitle className='!invisible'>
                <DrawerDescription>Mobile Navigation Sidebar</DrawerDescription>
              </DrawerTitle>

              <DrawerClose className=' ml-6 mt-2 mb-4 text-[2.5rem]'>
                <BsCaretLeftFill />
              </DrawerClose>

              {/* ...... */}
              <NavList />

              {/* {children} */}
            </DrawerContent>
          </DrawerOverlay>
        </Drawer>
      )}
    </>
  );
};

export default SideDrawer;

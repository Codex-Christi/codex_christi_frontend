'use client';

import { Dispatch, FC, ReactNode, SetStateAction } from 'react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { BsCaretLeftFill } from 'react-icons/bs';
import useResponsiveSSR from '@/lib/hooks/useResponsiveSSR';
import NavList from './NavList';

// Interfaces
interface SideDrawerInterface {
  children?: ReactNode;
  openState: boolean;
  openCloseController: Dispatch<SetStateAction<boolean>>;
}

const SideDrawer: FC<SideDrawerInterface> = ({
  openState,
  openCloseController,
  children,
}) => {
  // Hooks
  const { isDesktopOnly } = useResponsiveSSR();

  // Main JSX
  return (
    <>
      {!isDesktopOnly && (
        <Drawer
          direction='right'
          open={openState}
          onOpenChange={openCloseController}
        >
          <DrawerContent
            className={` !rounded-none h-full bg-black/80  !border-none
                !fixed !bottom-0 !right-0 !z-[500] w-full max-w-[600px]`}
          >
            <DrawerTitle className='!invisible'>
              <DrawerDescription>Fixed the warning</DrawerDescription>
            </DrawerTitle>

            <DrawerClose className=' ml-6 mt-2 mb-4 text-[2.5rem]'>
              <BsCaretLeftFill />
            </DrawerClose>

            {/* ...... */}
            <NavList />

            {/* {children} */}
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
};

export default SideDrawer;

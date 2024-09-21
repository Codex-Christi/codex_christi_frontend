'use client';

import { Dispatch, FC, ReactNode, SetStateAction } from 'react';
import { Drawer, DrawerClose, DrawerContent } from '@/components/ui/drawer';
import useResponsiveSSR from '@/lib/useResponsiveSSR';
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
          {/* ...... */}
          {/* <NavList /> */}

          <DrawerContent
            className={` !rounded-none h-full bg-[#121212] !border-none
                !fixed !bottom-0 !right-0 !z-[500] w-full max-w-[600px]`}
          >
            {/* {children} */}
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
};

export default SideDrawer;

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
import NavList from './NavList';

// Interfaces
interface SideDrawerInterface {
  children?: ReactNode;
  openState: boolean;
  openCloseController: Dispatch<SetStateAction<boolean>>;
}

const SideDrawer: FC<SideDrawerInterface> = ({ openState, openCloseController }) => {
  // Main JSX
  return (
    <Drawer direction='right' open={openState} onOpenChange={openCloseController}>
      <DrawerOverlay className='bg-black/[0.01] !backdrop-blur-[10px] lg:hidden' />
      <DrawerContent
        className='!rounded-none h-full bg-black/80 !border-none
              !fixed !bottom-0 !right-0 !z-[500] w-full ml-auto !max-w-[600px] after:!hidden lg:hidden'
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
    </Drawer>
  );
};

export default SideDrawer;

import { SetStateAction } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerOverlay,
  DrawerTitle,
} from '../primitives/drawer';
import EditModalFields from './EditModalFields';

// CSS Imports

// Main Modal Component
const EditProfileModal = ({
  isActive,
  setIsActive,
}: {
  isActive: boolean;
  setIsActive: React.Dispatch<SetStateAction<boolean>>;
}) => {
  return (
    <>
      <Drawer direction='right' open={isActive} onOpenChange={setIsActive}>
        <DrawerOverlay
          className={` bg-black/[0.01] !backdrop-blur-[10px]`}
          //   onClick={() => setIsActive(false)}
        >
          <DrawerContent
            className={` !rounded-none h-full bg-black/80  !border-none
                !fixed !bottom-0 !right-0 !z-[500] w-full `}
          >
            <DrawerTitle className='!invisible'>
              <DrawerDescription>Edit Profile Modal</DrawerDescription>
            </DrawerTitle>

            {/* Main Profile Modal Fields Starts Here */}

            <EditModalFields isActive={isActive} setIsActive={setIsActive} />

            {/* Ends Here*/}
          </DrawerContent>
        </DrawerOverlay>
      </Drawer>
    </>
  );
};

export default EditProfileModal;

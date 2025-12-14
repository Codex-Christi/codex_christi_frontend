import { SetStateAction } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerOverlay,
  DrawerTitle,
} from '../../primitives/drawer';
import EditModalFields from './EditModalFields';

const EditProfileModal = ({
  isActive,
  setIsActive,
}: {
  isActive: boolean;
  setIsActive: React.Dispatch<SetStateAction<boolean>>;
}) => {
  const handleClose = () => setIsActive(false);

  return (
    <Drawer direction='right' open={isActive} onOpenChange={setIsActive} shouldScaleBackground>
      <DrawerOverlay className='bg-black/[0.01] !backdrop-blur-[10px]' />

      <DrawerContent className='!fixed !inset-0 !z-[500] flex items-center justify-center !border-none !bg-transparent pointer-events-none'>
        <DrawerTitle className='sr-only'>
          <DrawerDescription>Edit Profile Modal</DrawerDescription>
        </DrawerTitle>

        <div className='pointer-events-auto w-[92%] max-w-[720px] mt-0 md:-mt-8 lg:-mt-16'>
          <div
            className='flex h-[calc(100vh-3rem)] max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[12px]
           bg-[#050505]/95 text-white shadow-[0_25px_60px_rgba(0,0,0,0.65)] backdrop-blur-xl md:h-[calc(100vh-4rem)]'
          >
            <EditModalFields isOpen={isActive} onRequestClose={handleClose} />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default EditProfileModal;

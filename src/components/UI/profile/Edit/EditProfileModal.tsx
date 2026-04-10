'use client';

import { SetStateAction, useCallback, useMemo, useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerOverlay,
  DrawerTitle,
} from '../../primitives/drawer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../primitives/alert-dialog';
import EditModalFields from './EditModalFields';
import { useEditUserMainProfileStore } from '@/stores/editUserProfileStore';
import { useHistoryStateClose } from '@/lib/hooks/useHistoryStateClose';

const EDIT_PROFILE_HISTORY_KEY = '__editProfileModal';

const EditProfileModal = ({
  isActive,
  setIsActive,
}: {
  isActive: boolean;
  setIsActive: React.Dispatch<SetStateAction<boolean>>;
}) => {
  const pendingEdits = useEditUserMainProfileStore((state) => state.userEditData);
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);

  const hasPendingChanges = useMemo(
    () => !!pendingEdits && Object.keys(pendingEdits).length > 0,
    [pendingEdits],
  );

  const closeModal = useCallback(() => {
    setIsDiscardDialogOpen(false);
    setIsActive(false);
    return true;
  }, [setIsActive]);

  const requestClose = useCallback(() => {
    if (hasPendingChanges) {
      if (!isDiscardDialogOpen) {
        setIsDiscardDialogOpen(true);
      }
      return false;
    }

    return closeModal();
  }, [closeModal, hasPendingChanges, isDiscardDialogOpen]);

  const handleDrawerOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setIsActive(true);
        return;
      }

      requestClose();
    },
    [requestClose, setIsActive],
  );

  useHistoryStateClose({
    isOpen: isActive,
    historyKey: EDIT_PROFILE_HISTORY_KEY,
    onRequestClose: requestClose,
  });

  return (
    <>
      <AlertDialog open={isDiscardDialogOpen} onOpenChange={setIsDiscardDialogOpen}>
        <AlertDialogContent className='bg-black/80 backdrop-blur-xl border border-white/10 text-white shadow-2xl shadow-black/70 rounded-2xl max-w-md w-[90vw]'>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription className='text-gray-200'>
              You have profile edits that haven&apos;t been saved yet. If you close now, those changes
              will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className='border border-white/20 bg-transparent text-white/80 hover:bg-white/5 hover:text-white rounded-lg px-4'>
              Keep editing
            </AlertDialogCancel>
            <AlertDialogAction
              className='bg-rose-600 text-white hover:bg-rose-500 rounded-lg px-4'
              onClick={closeModal}
            >
              Discard and close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Drawer
        direction='right'
        open={isActive}
        onOpenChange={handleDrawerOpenChange}
        shouldScaleBackground
      >
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
            <EditModalFields isOpen={isActive} onRequestClose={requestClose} />
          </div>
        </div>
      </DrawerContent>
      </Drawer>
    </>
  );
};

export default EditProfileModal;

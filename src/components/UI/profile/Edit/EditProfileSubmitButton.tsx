import React, { useCallback, useState } from 'react';
import { Button } from '../../primitives/button';
import {
  useValidateUserEditData,
  useEditUserMainProfileStore,
} from '@/stores/editUserProfileStore';
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';
import { UserProfileDataInterface } from '@/lib/types/user-profile/main-user-profile';
import loadingToast from '@/lib/loading-toast';
import errorToast from '@/lib/error-toast';
import successToast from '@/lib/success-toast';
import { toast } from 'sonner';
import { updateMyProfile } from '@/actions/account/profile';
import { getAuthGeneration } from '@/lib/auth/session-generation';

// Interfaces
interface UserPatchResponse {
  status: number;
  success: boolean;
  message: string;
  data: UserProfileDataInterface;
}

// The server owns the Django token and validates this form again.
const patchUser = async (formData: FormData): Promise<UserPatchResponse> => {
  const result = await updateMyProfile(formData);
  if (!result.success) throw new Error(result.error);
  return { success: true, status: 200, message: 'Profile updated.', data: result.data };
};

// Main Component
const EditProfileSubmitButton = ({ onClose }: { onClose?: () => void }) => {
  // Hooks
  const { validate } = useValidateUserEditData();
  const [isLoading, setIsLoading] = useState(false);
  const clearEditData = useEditUserMainProfileStore((state) => state.clearEditData);
  const setUserMainProfile = useUserMainProfileStore((state) => state.setUserMainProfile);
  const pendingEdits = useEditUserMainProfileStore((state) => state.userEditData);

  // Submit Patch Data
  const submitPatchData = useCallback(async () => {
    if (!pendingEdits || Object.keys(pendingEdits).length === 0) {
      errorToast({ message: 'You have not made any changes.' });
      return;
    }

    const submissionData = validate();

    if (!submissionData.success) {
      const firstKey = Object.keys(submissionData.errors)[0];
      const firstError = Object.values(submissionData.errors)[0];

      errorToast({
        message:
          firstKey === 'undefined'
            ? 'You have not made any changes.'
            : `${firstKey} field: ${firstError}`,
      });
      return;
    }

    if (!submissionData.data) {
      errorToast({ message: 'No data to submit.' });
      return;
    }

    const formData = new FormData();
    for (const key in submissionData.data) {
      formData.set(
        key,
        submissionData.data[key as keyof typeof submissionData.data] as string | Blob,
      );
    }

    setIsLoading(true);
    const generation = getAuthGeneration();
    const loadingToastID = loadingToast({ message: 'Updating user details...' });

    try {
      const response = await patchUser(formData);
      if (generation !== getAuthGeneration()) return;

      toast.dismiss(loadingToastID);

      successToast({
        message: 'Profile updated successfully.',
        header: 'Profile Updated',
      });

      if (response?.data) {
        // Zustand subscribers update immediately when this setter runs.
        setUserMainProfile(response.data);
        clearEditData();
        onClose?.();
      }
    } catch (error) {
      toast.dismiss(loadingToastID);
      const fallbackMessage = 'Error updating profile. Please try again.';
      const message = error instanceof Error ? error.message : fallbackMessage;

      errorToast({ message });
    } finally {
      toast.dismiss(loadingToastID);
      setIsLoading(false);
    }
  }, [clearEditData, onClose, pendingEdits, setUserMainProfile, validate]);

  // Main JSx
  return (
    <Button
      name='Edit Profile - Submit'
      id='edit-profile-submit'
      aria-label='Edit Profile'
      className='bg-[#0085FF] text-white font-semibold rounded pt-1.5 pb-2 px-5 mx-auto block'
      type='button'
      onClick={submitPatchData}
      disabled={isLoading}
    >
      {isLoading ? 'Saving…' : 'Save changes'}
    </Button>
  );
};

export default EditProfileSubmitButton;

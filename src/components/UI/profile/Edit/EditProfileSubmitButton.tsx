import React, { useCallback, useTransition } from 'react';
import { Button } from '../../primitives/button';
import { useValidateUserEditData } from '@/stores/editUserProfileStore';

const EditProfileSubmitButton = () => {
  // Hooks
  const { validate } = useValidateUserEditData();

  // useEffects
  const submitPatchData = useCallback(() => {
    // Validate the data
    const submissionData = validate();
    const formData = new FormData();

    // Convert the data to FormData
    if (submissionData.success && submissionData.data) {
      for (const key in submissionData.data) {
        formData.set(
          key,
          submissionData.data[key as keyof typeof submissionData.data] as
            | string
            | Blob
        );
      }
    }

    console.log('FormData:', formData.get('profile_pic'));
  }, [validate]);

  // Main JSx
  return (
    <Button
      name='Edit Profile - Submit'
      id='edit-profile-submit'
      aria-label='Edit Profile'
      className='bg-[#0085FF] text-white font-semibold rounded py-3 px-5 mx-auto block'
      type='button'
      onClick={submitPatchData}
    >
      Save changes
    </Button>
  );
};

export default EditProfileSubmitButton;

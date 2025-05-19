import React, { useEffect } from 'react';
import { Button } from '../../primitives/button';
import {
  useSubmitEditData,
  useEditUserMainProfileStore,
} from '@/stores/editUserProfileStore';
import { validateUserEditData } from '@/stores/editUserProfileStore';

const EditProfileSubmitButton = () => {
  // Hooks
  const { diffData } = useSubmitEditData();
  const { fieldErrors } = useEditUserMainProfileStore((state) => state);

  // useEffects
  useEffect(() => {
    // Check if there is any data to submit
    if (diffData && Object.keys(diffData).length > 0) {
      console.log('Submitting data:', validateUserEditData(diffData));
    } else {
      console.log('No data to submit');
    }
  }, [diffData]);

  // Main JSx
  return (
    <Button
      name='Edit Profile - Submit'
      id='edit-profile-submit'
      aria-label='Edit Profile'
      className='bg-[#0085FF] text-white font-semibold rounded py-3 px-5 mx-auto block'
      type='button'
    >
      Save changes
    </Button>
  );
};

export default EditProfileSubmitButton;

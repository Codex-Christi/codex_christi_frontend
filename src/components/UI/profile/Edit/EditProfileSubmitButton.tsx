import React, { useEffect } from 'react';
import { Button } from '../../primitives/button';
import { useSubmitEditData } from '@/stores/editUserProfileStore';
import { useValidateUserEditData } from '@/stores/editUserProfileStore';

const EditProfileSubmitButton = () => {
  // Hooks
  const { diffData } = useSubmitEditData();
  const { errors, validate } = useValidateUserEditData();

  // useEffects
  useEffect(() => {
    // Check if there is any data to submit
    console.log('Submitting data:', validate());

    if (errors) {
      console.log(errors);
    }
  }, [errors, validate]);

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

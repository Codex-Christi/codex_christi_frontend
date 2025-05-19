import React, { FC, useState } from 'react';
import UserAvatar from '../UserAvatar';
import { Pencil } from 'lucide-react';
import { Input } from '../../primitives/input';
import { useRef } from 'react';
import { Label } from '../../primitives/label';
import { useEditUserMainProfileStore } from '@/stores/editUserProfileStore';

// Main Component
// This component allows the user to edit their profile picture
const EditProfilePicture: FC = () => {
  // Hooks
  const editProfileData = useEditUserMainProfileStore(
    (state) => state.userEditData
  );
  const setUserEditData = useEditUserMainProfileStore(
    (state) => state.setUserEditData
  );

  //   State values
  const [imageUrl, setImageUrl] = useState('');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleIconClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click(); // Programmatically trigger the file input
    }
  };

  // Handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const file = e.target.files[0];
      // Do something with the file, e.g., upload it, display file name
      setUserEditData({
        ...editProfileData,
        profile_pic: file,
      });
      // Reset the file input value
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // Clear the input value
      }

      // Optionally, you can also display the image preview
      setImageUrl(URL.createObjectURL(file));
    }
  };

  // Main JSX
  return (
    <>
      <Label
        className='relative !size-20 rounded-full mx-auto my-10 flex items-center justify-center cursor-pointer'
        aria-label='Update Profile Picture'
        aria-required='true'
        onClick={handleIconClick}
      >
        {/* User Avatar */}
        <UserAvatar
          className='rounded-full mx-auto'
          src={imageUrl ? imageUrl : undefined}
        />

        {!imageUrl && (
          <>
            <div className='absolute w-full inset-0 size-full grid place-content-center'>
              <svg width='32' height='26' viewBox='0 0 32 26' fill='none'>
                <path
                  d='M29 26H3C1.346 26 0 24.654 0 23V7C0 5.346 1.346 4 3 4H7.381L9.102 0.554C9.27 0.214 9.617 0 9.996 0H22.006C22.385 0 22.731 0.214 22.901 0.554L24.619 4H29C30.654 4 32 5.346 32 7V23C32 24.654 30.654 26 29 26ZM30 7C30 6.449 29.551 6 29 6H24C23.95 6 23.907 5.979 23.859 5.972C23.788 5.961 23.717 5.955 23.649 5.929C23.588 5.906 23.537 5.869 23.482 5.834C23.428 5.801 23.373 5.773 23.326 5.729C23.273 5.68 23.235 5.62 23.194 5.56C23.166 5.52 23.127 5.491 23.105 5.446L21.387 2H10.615L8.895 5.446C8.848 5.541 8.785 5.623 8.715 5.695C8.701 5.71 8.684 5.719 8.669 5.733C8.597 5.798 8.518 5.851 8.432 5.892C8.403 5.907 8.375 5.919 8.344 5.931C8.234 5.971 8.12 5.999 8.002 6H8H3C2.449 6 2 6.449 2 7V23C2 23.551 2.449 24 3 24H29C29.551 24 30 23.551 30 23V7ZM16 21C12.14 21 9 17.86 9 14C9 10.14 12.14 7 16 7C19.86 7 23 10.14 23 14C23 17.86 19.86 21 16 21ZM16 9C13.243 9 11 11.243 11 14C11 16.757 13.243 19 16 19C18.757 19 21 16.757 21 14C21 11.243 18.757 9 16 9Z'
                  fill='white'
                />
              </svg>
            </div>

            <Pencil className='absolute top-0 right-0' />
          </>
        )}
      </Label>
      <Input
        type='file'
        ref={fileInputRef}
        className='hidden'
        accept='image/*'
        id='fileInput'
        name='profile_pic'
        aria-label='Update Profile Picture'
        aria-required='true'
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </>
  );
};

export default EditProfilePicture;

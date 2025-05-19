import { FC } from 'react';

import ProfileImage from '@/assets/img/profile-img.png';
import Image from 'next/image';
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';

const UserAvatar: FC<{ size: number }> = ({ size }) => {
  // Hooks
  const userMainProfile = useUserMainProfileStore(
    (state) => state.userMainProfile
  );

  // Main JSX
  return (
    <Image
      className='size-20 rounded-full'
      src={userMainProfile?.profile_pic || ProfileImage}
      width={size ? size : 80}
      height={size ? size : 80}
      priority
      alt='User Avatar'
    />
  );
};

export default UserAvatar;

import { FC } from 'react';

import ProfileImage from '@/assets/img/profile-img.png';
import Image from 'next/image';
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';

const UserAvatar: FC<{
  size: number;
  className?: string;
  src?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}> = ({ size, className, src, ...rest }) => {
  // Hooks
  const userMainProfile = useUserMainProfileStore(
    (state) => state.userMainProfile
  );

  // Main JSX
  return (
    <Image
      className={`rounded-full ${className} h-[inherit]`}
      src={
        src ||
        (typeof userMainProfile?.profile_pic === 'string'
          ? userMainProfile.profile_pic
          : ProfileImage)
      }
      width={size}
      height={size}
      priority
      alt='User Avatar'
      style={{
        width: `${size}px !important`,
        height: `${size}px !important`,
        maxWidth: `${size}px !important`,
      }}
      {...rest}
    />
  );
};

export default UserAvatar;

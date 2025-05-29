import { FC, useState } from 'react';
import { ImageProps } from 'next/image';
import { Skeleton } from '../../primitives/skeleton';
import MainProfileAvatar from '../../profile/UserAvatar';
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';

type UserAvatarInterface = Omit<ImageProps, 'width' | 'height' | 'src'> & {
  width: number;
  height: number;
};

const UserAvatar: FC<UserAvatarInterface> = (props) => {
  // Hooks
  const [loaded, setLoaded] = useState<boolean>(false);
  const userMainProfile = useUserMainProfileStore(
    (state) => state.userMainProfile
  );
  const { username } = userMainProfile ? userMainProfile : {};

  // Props
  const { width } = props;

  return (
    <div
      className={`flex flex-col items-center`}
      // min-h-[${height + 12}px] min-w-[${width + 12}px]
    >
      {!loaded && <Skeleton className={` size-[30px] rounded-full p-0`} />}
      <MainProfileAvatar
        size={width ? width : 30}
        {...props}
        alt='User Avatar'
        className='rounded-full size-[30px]'
        onLoad={() => setLoaded(true)}
      />

      {/* <small className='text-[.95rem] font-semibold leading-none mt-2'>
        {username ? username : 'User'}
      </small> */}
    </div>
  );
};

export default UserAvatar;

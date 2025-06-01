import { FC } from 'react';
import { ImageProps } from 'next/image';
import MainProfileAvatar from '../../profile/UserAvatar';

type UserAvatarInterface = Omit<ImageProps, 'width' | 'height' | 'src'> & {
  width: number;
  height: number;
};

const UserAvatar: FC<UserAvatarInterface> = (props) => {
  // Hooks

  // Props
  const { width } = props;

  return (
    <div
      className={`flex flex-col items-center`}
      // min-h-[${height + 12}px] min-w-[${width + 12}px]
    >
      <MainProfileAvatar
        size={width ? width : 30}
        {...props}
        alt='User Avatar'
        className='rounded-full size-[30px]'
      />

      {/* <small className='text-[.95rem] font-semibold leading-none mt-2'>
        {username ? username : 'User'}
      </small> */}
    </div>
  );
};

export default UserAvatar;

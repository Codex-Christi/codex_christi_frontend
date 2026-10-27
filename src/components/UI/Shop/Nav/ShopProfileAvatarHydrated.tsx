'use client';

import { useEffect } from 'react';
import type { ImageProps } from 'next/image';
import MainProfileAvatar from '../../profile/UserAvatar';
import { useAuthStore } from '@/stores/authStore';
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';

type ShopProfileAvatarHydratedProps = Omit<ImageProps, 'src'> & {
  width: number;
  height: number;
};

export default function ShopProfileAvatarHydrated({
  width,
  height,
  className,
  ...props
}: ShopProfileAvatarHydratedProps) {
  const userID = useAuthStore((state) => state.userSessionInfo?.user_id);
  const setProfileFromServer = useUserMainProfileStore((state) => state.setProfileFromServer);

  useEffect(() => {
    if (userID && useUserMainProfileStore.getState().userMainProfile?.id !== userID)
      void setProfileFromServer();
  }, [userID, setProfileFromServer]);

  return (
    <MainProfileAvatar
      {...props}
      width={width}
      height={height}
      alt={typeof props.alt === 'string' ? props.alt : 'User avatar'}
      className={`!size-full rounded-full object-cover object-center ${className ?? ''}`}
      sizes={`${width}px`}
      quality={75}
      loading='lazy'
    />
  );
}

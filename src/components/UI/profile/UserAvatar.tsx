// src/components/UI/profile/UserAvatar.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import type { FC } from 'react';
import Image, { StaticImageData } from 'next/image';
import ProfileImage from '@/assets/img/profile-img.png';
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';
import { cn } from '@/lib/utils';

const UserAvatar: FC<{
  height?: number;
  width?: number;
  className?: string;
  src?: string | StaticImageData;
  [key: string]: any;
}> = ({ height = 50, width = 50, className, src, ...rest }) => {
  // ⚠️ IMPORTANT: use separate selectors to avoid returning a new object every time
  const userMainProfile = useUserMainProfileStore((state) => state.userMainProfile);
  const hydrated = useUserMainProfileStore((state) => state._hydrated);

  // While store is still hydrating from sessionStorage, show skeleton
  if (!hydrated) {
    return (
      <div
        className={cn('size-12 rounded-full bg-gray-200 animate-pulse', className)}
        style={{ width, height }}
      />
    );
  }

  // After hydration:
  // - If userMainProfile is null → use static fallback image
  // - If profile_pic is a string → use that
  const fallbackSrc =
    userMainProfile?.profile_pic && typeof userMainProfile.profile_pic === 'string'
      ? userMainProfile.profile_pic
      : ProfileImage;

  const imageSrc = src ?? fallbackSrc;

  return (
    <Image
      className={cn('rounded-full h-[inherit] object-cover object-center', className)}
      src={imageSrc}
      width={width}
      height={height}
      quality={100}
      alt={
        userMainProfile
          ? `${userMainProfile.first_name ?? ''} ${userMainProfile.last_name ?? ''}`
          : 'User Avatar'
      }
      priority
      {...rest}
    />
  );
};

export default UserAvatar;

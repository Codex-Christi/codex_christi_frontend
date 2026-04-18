// src/components/UI/profile/UserAvatar.tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import type { FC } from 'react';
import Image, { StaticImageData } from 'next/image';
import { User } from 'lucide-react';
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';
import { cn } from '@/lib/utils';

const UserAvatar: FC<{
  height?: number;
  width?: number;
  className?: string;
  src?: string | StaticImageData;
  alt?: string;
  [key: string]: any;
}> = ({ height = 50, width = 50, className, src, alt, ...rest }) => {
  const userMainProfile = useUserMainProfileStore((state) => state.userMainProfile);
  const imageSrc =
    src ??
    (userMainProfile?.profile_pic && typeof userMainProfile.profile_pic === 'string'
      ? userMainProfile.profile_pic
      : undefined);
  const altText =
    alt ||
    (userMainProfile
      ? `${userMainProfile.first_name ?? ''} ${userMainProfile.last_name ?? ''}`.trim() ||
        'User Avatar'
      : 'User Avatar');

  if (!imageSrc) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-muted text-muted-foreground',
          className,
        )}
        style={{ width, height }}
        role='img'
        aria-label={altText}
        {...rest}
      >
        <User className='size-[55%]' strokeWidth={1.75} />
      </div>
    );
  }

  return (
    <Image
      className={cn('rounded-full h-[inherit] object-cover object-center', className)}
      src={imageSrc}
      width={width}
      height={height}
      quality={100}
      alt={altText}
      priority
      {...rest}
    />
  );
};

export default UserAvatar;

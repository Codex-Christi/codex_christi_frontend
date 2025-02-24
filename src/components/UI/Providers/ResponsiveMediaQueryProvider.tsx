'use client';

import { useResponsiveSSRInitial } from '@/lib/hooks/useResponsiveSSR_Store';
import { ReactNode } from 'react';

export default function ResponsiveMediaProvider({
  children,
}: {
  children: ReactNode;
}) {
  useResponsiveSSRInitial();

  return <>{children}</>;
}

'use client';

import { useResponsiveSSRInitial } from '@/lib/hooks/useResponsiveSSR_Store';
import { ReactNode, useEffect } from 'react';

export default function ResponsiveMediaProvider({ children }: { children: ReactNode }) {
  const { updateRespState } = useResponsiveSSRInitial();

  useEffect(() => {
    updateRespState();
  }, [updateRespState]);

  return <>{children}</>;
}

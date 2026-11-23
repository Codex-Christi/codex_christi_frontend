'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { publicShopPath } from '@/lib/auth/domain-routing';
import { usePublicRuntimeConfig } from '@/lib/runtime-config/hooks';

export const useShopRouter = () => {
  const router = useRouter();
  const origins = usePublicRuntimeConfig();

  const push = useCallback(
    (path: string) => {
      const hostname = typeof window === 'undefined' ? null : window.location.hostname;

      return router.push(publicShopPath(path, hostname ?? '', origins));
    },
    [router, origins],
  );

  return { push };
};

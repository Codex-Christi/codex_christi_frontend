'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { isShopSiteHostname } from '@/lib/siteBaseUrls';

export const useShopRouter = () => {
  const router = useRouter();

  const push = useCallback(
    (path: string) => {
      const hostname = typeof window === 'undefined' ? null : window.location.hostname;

      if (isShopSiteHostname(hostname) && path.startsWith('/shop')) {
        const trimmed = path.split('/shop')[1] || '/';
        const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
        return router.push(normalized);
      }
      return router.push(path);
    },
    [router],
  );

  return { push };
};

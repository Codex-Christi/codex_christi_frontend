'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export const useShopRouter = () => {
  const router = useRouter();
  const [hostname, setHostname] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setHostname(window.location.hostname);
  }, []);

  const push = useCallback(
    (path: string) => {
      if (hostname === 'codexchristi.shop' && path.startsWith('/shop')) {
        const trimmed = path.split('/shop')[1] || '/';
        const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
        return router.push(normalized);
      }
      return router.push(path);
    },
    [hostname, router],
  );

  return { push };
};

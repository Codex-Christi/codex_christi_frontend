// hooks/useRouteChangeEffect.ts
'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { patchHistory, addHistoryHandler } from '@/lib/patches/history-patch';

export function useRouteChangeAware(effect: () => void) {
  const pathname = usePathname();
  const isRouteChangingRef = useRef(false);
  const effectRef = useRef(effect);

  // Update effect reference on each render
  useEffect(() => {
    effectRef.current = effect;
  });

  useEffect(() => {
    // Ensure history is patched (client-side only)
    patchHistory();

    const unregister = addHistoryHandler(() => {
      isRouteChangingRef.current = true;
    });

    return () => {
      unregister();
      if (isRouteChangingRef.current) {
        effectRef.current();
        isRouteChangingRef.current = false;
      }
    };
  }, [pathname]);
}

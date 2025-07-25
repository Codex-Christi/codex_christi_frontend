'use client';
import { useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';

export function useRouteChangeAware(effect: () => void) {
  const pathname = usePathname();
  const routeChangeRef = useRef(false);
  const originalMethodsRef = useRef({
    pushState: history.pushState,
    replaceState: history.replaceState,
  });

  // Stable effect reference
  const stableEffect = useCallback(effect, [effect]);

  useEffect(() => {
    const { pushState, replaceState } = originalMethodsRef.current;

    // Patch history methods
    history.pushState = function (...args) {
      routeChangeRef.current = true;
      return pushState.apply(this, args);
    };

    history.replaceState = function (...args) {
      routeChangeRef.current = true;
      return replaceState.apply(this, args);
    };

    return () => {
      // Restore original methods first
      history.pushState = pushState;
      history.replaceState = replaceState;

      // Execute effect if route changed
      if (routeChangeRef.current) {
        stableEffect();
        routeChangeRef.current = false;
      }
    };
  }, [pathname, stableEffect]);
}

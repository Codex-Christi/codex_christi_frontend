'use client';
import { useAuthStore } from '@/stores/authStore';
import { ReactNode, useEffect } from 'react';

type IdleCallbackHandle = number;
type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => IdleCallbackHandle;
  cancelIdleCallback?: (handle: IdleCallbackHandle) => void;
};

// Main Provider Component
function LoggedinProvider({ children }: { children: ReactNode }) {
  // Hooks
  const autoUpDateSession = useAuthStore((state) => state.autoUpDateSession);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // useEffects
  useEffect(() => {
    if (isAuthenticated) return;

    const idleWindow = window as WindowWithIdleCallback;
    let cancelled = false;

    const syncSession = () => {
      if (!cancelled) void autoUpDateSession();
    };

    if (idleWindow.requestIdleCallback) {
      const idleId = idleWindow.requestIdleCallback(syncSession, { timeout: 3000 });
      return () => {
        cancelled = true;
        idleWindow.cancelIdleCallback?.(idleId);
      };
    }

    const timeoutId = window.setTimeout(syncSession, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [autoUpDateSession, isAuthenticated]);

  // Main JSX
  return <>{children}</>;
}

export default LoggedinProvider;

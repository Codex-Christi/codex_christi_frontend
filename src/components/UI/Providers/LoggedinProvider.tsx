'use client';
import { useAuthStore } from '@/stores/authStore';
import { ReactNode, useEffect, useCallback } from 'react';
import { useCustomToast } from '@/lib/hooks/useCustomToast';
import { useIsLoggedIn } from '@/stores/authStore';

// Main Provider Component
function LoggedinProvider({ children }: { children: ReactNode }) {
  // Hooks
  const { sessionCookie, autoUpDateSession } = useAuthStore((state) => state);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { triggerCustomToast } = useCustomToast();

  // Direct Hook Calls
  // useIsLoggedIn();

  // useEffects
  useEffect(() => {
    autoUpDateSession();
  }, [autoUpDateSession]);

  useEffect(() => {
    console.log(sessionCookie);
  }, [sessionCookie]);

  // Main JSX

  return <>{children}</>;
}

export default LoggedinProvider;

'use client';
import { useAuthStore } from '@/stores/authStore';
import { ReactNode, useEffect } from 'react';
import { useCustomToast } from '@/lib/hooks/useCustomToast';

// Main Provider Component
function LoggedinProvider({ children }: { children: ReactNode }) {
  // Hooks
  const { autoUpDateSession } = useAuthStore((state) => state);
  const { triggerCustomToast } = useCustomToast();

  // Direct Hook Calls
  // useIsLoggedIn();

  // useEffects
  useEffect(() => {
    autoUpDateSession();
  }, [autoUpDateSession]);

  // Main JSX
  return <>{children}</>;
}

export default LoggedinProvider;

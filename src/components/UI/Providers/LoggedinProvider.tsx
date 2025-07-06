'use client';
import { useAuthStore } from '@/stores/authStore';
import { ReactNode, useEffect } from 'react';

// Main Provider Component
function LoggedinProvider({ children }: { children: ReactNode }) {
  // Hooks
  const { autoUpDateSession, isAuthenticated } = useAuthStore((state) => state);

  // useEffects
  useEffect(() => {
    if (!isAuthenticated) {
      autoUpDateSession();
    }
  }, [autoUpDateSession, isAuthenticated]);

  // Main JSX
  return <>{children}</>;
}

export default LoggedinProvider;

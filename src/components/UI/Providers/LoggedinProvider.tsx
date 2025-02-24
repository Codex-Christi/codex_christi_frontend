'use client';
import { useAuthStore } from '@/stores/authStore';
import { ReactNode, useEffect, useMemo } from 'react';
import { redirect } from 'next/navigation';
import { useCustomToast } from '@/lib/hooks/useCustomToast';

// Main Provider Component
function LoggedinSuccessRedirectProvider({
  children,
}: {
  children: ReactNode;
}) {
  // Hooks
  const accessToken = useAuthStore((state) => state.accessToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { triggerCustomToast } = useCustomToast();

  // Bools
  const isReallyAuthenticated = useMemo(
    () => !!accessToken && !!isAuthenticated,
    [accessToken, isAuthenticated]
  );

  // useEffects
  useEffect(() => {
    if (isReallyAuthenticated) {
      setTimeout(() => {
        triggerCustomToast(
          'success',
          `You're already logged in`,
          'Confirmation'
        );
        redirect('/');
      }, 50);
    }
  }, [accessToken, isReallyAuthenticated, triggerCustomToast]);

  // Main JSX
  if (!isReallyAuthenticated) {
    return <>{children}</>;
  }
}

export default LoggedinSuccessRedirectProvider;

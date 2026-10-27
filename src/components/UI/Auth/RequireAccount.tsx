'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCw } from 'lucide-react';
import useAuthStore from '@/stores/authStore';
import {
  authFlowUrl,
  getAuthRoutes,
  publicShopPath,
  safeAuthReturnPath,
} from '@/lib/auth/domain-routing';

export default function RequireAccount({
  children,
  shop = false,
}: {
  children: ReactNode;
  shop?: boolean;
}) {
  const status = useAuthStore((state) => state.status);
  const router = useRouter();
  useEffect(() => {
    if (status !== 'anonymous') return;
    const routes = getAuthRoutes(window.location.hostname, shop);
    const path = publicShopPath(
      `${window.location.pathname}${window.location.search}`,
      window.location.hostname,
    );
    router.replace(authFlowUrl(routes.login, { next: safeAuthReturnPath(path, routes) }));
  }, [router, shop, status]);
  if (status === 'unavailable')
    return (
      <div role='alert' className='mx-auto min-h-40 py-8 text-center space-y-4'>
        <p>Sign-in is temporarily unavailable. Please try again.</p>
        <button
          type='button'
          className='inline-flex items-center gap-2 underline'
          onClick={() => {
            void useAuthStore.getState().refreshAuthState();
          }}
        >
          <RotateCw size={16} />
          Retry
        </button>
      </div>
    );
  if (status !== 'authenticated')
    return (
      <div role='status' className='mx-auto min-h-40 py-8 text-center'>
        Checking sign-in...
      </div>
    );
  return children;
}

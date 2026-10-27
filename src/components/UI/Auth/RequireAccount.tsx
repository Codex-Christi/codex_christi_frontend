'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import useAuthStore from '@/stores/authStore';
import {
  authFlowUrl,
  getAuthRoutes,
  publicShopPath,
  safeAuthReturnPath,
} from '@/lib/auth/domain-routing';
import { accountViewState } from '@/lib/auth/account-view-state';
import type { AuthSessionState } from '@/lib/auth/session-snapshot';
import { AccountAccessContext } from './AccountAccessContext';
import AuthUnavailable from './AuthUnavailable';

export default function RequireAccount({
  children,
  shop = false,
  initialSession,
}: {
  children: ReactNode;
  shop?: boolean;
  initialSession?: AuthSessionState;
}) {
  const state = useAuthStore();
  const view = accountViewState(state, initialSession);
  const router = useRouter();

  useEffect(() => {
    if (initialSession) useAuthStore.getState().seedServerSession(initialSession);
  }, [initialSession]);

  useEffect(() => {
    if (state.status !== 'anonymous') return;
    const routes = getAuthRoutes(window.location.hostname, shop);
    const path = publicShopPath(
      `${window.location.pathname}${window.location.search}`,
      window.location.hostname,
    );
    router.replace(authFlowUrl(routes.login, { next: safeAuthReturnPath(path, routes) }));
  }, [router, shop, state.status]);

  return (
    <>
      <AccountAccessContext.Provider value={view.visible}>
        <div
          key={view.ownerId ?? 'no-account'}
          hidden={!view.visible}
          inert={!view.visible}
          style={{ display: view.visible ? 'contents' : 'none' }}
        >
          {view.retainContent ? children : null}
        </div>
      </AccountAccessContext.Provider>
      {view.status === 'unavailable' ? (
        <AuthUnavailable
          isRetrying={state.isRefreshing}
          onRetry={() => {
            void useAuthStore.getState().refreshAuthState({ resetRetries: true });
          }}
        />
      ) : !view.visible ? (
        <div role='status' className='mx-auto min-h-40 py-8 text-center'>
          Checking sign-in...
        </div>
      ) : null}
    </>
  );
}

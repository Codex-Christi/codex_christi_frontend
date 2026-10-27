'use client';

import useAuthStore from '@/stores/authStore';
import { clearPrivateClientState, publishSessionChange } from '@/lib/auth/client-session';
import { getAuthRoutes } from '@/lib/auth/domain-routing';
import errorToast from '@/lib/error-toast';

let pending: Promise<boolean> | null = null;
export const logoutUser = (): Promise<boolean> => {
  if (pending) return pending;
  pending = (async () => {
    const response = await fetch('/next-api/logout', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Unable to sign out. Please try again.');
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || !('success' in result) || result.success !== true)
      throw new Error('Unable to confirm logout. Please try again.');
    await clearPrivateClientState();
    useAuthStore.getState().setSessionState({ isAuthenticated: false, user_id: null });
    publishSessionChange('logout');
    const routes = getAuthRoutes(
      window.location.hostname,
      window.location.pathname.startsWith('/shop/'),
    );
    window.location.replace(`${routes.login}?from-logout=true`);
    return true;
  })()
    .catch((error) => {
      errorToast({
        message: error instanceof Error ? error.message : 'Unable to sign out. Please try again.',
      });
      return false;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
};

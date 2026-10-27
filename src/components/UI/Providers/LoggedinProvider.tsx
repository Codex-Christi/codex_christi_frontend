'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import useAuthStore from '@/stores/authStore';
import {
  clearPrivateClientState,
  clearPrivateWishlist,
  getAuthClientId,
} from '@/lib/auth/client-session';
import { clearUserMainProfileStore, useUserMainProfileStore } from '@/stores/userMainProfileStore';
import {
  clearUserShopProfile,
  useUserShopProfile,
} from '@/stores/shop_stores/use-user-shop-profile';

export default function LoggedinProvider({ children }: { children?: ReactNode }) {
  const path = usePathname();
  const id = useAuthStore((state) => state.userSessionInfo?.user_id ?? null);
  const status = useAuthStore((state) => state.status);
  const expiresAt = useAuthStore((state) => state.expiresAt);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    let lastCheck = 0;
    const sync = (force = false) => {
      if (!force && (document.visibilityState === 'hidden' || Date.now() - lastCheck < 15_000))
        return;
      lastCheck = Date.now();
      void useAuthStore.getState().refreshAuthState();
    };
    const receive = async (message: unknown) => {
      if (
        !message ||
        typeof message !== 'object' ||
        !('type' in message) ||
        !('source' in message) ||
        message.source === getAuthClientId()
      )
        return;
      const type = message.type;
      if (type !== 'login' && type !== 'logout') return;
      await clearPrivateClientState();
      useAuthStore.getState().setSessionState({ isAuthenticated: false, user_id: null });
      window.location.reload();
    };
    const onFocus = () => sync();
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'codex-auth-event') {
        try {
          void receive(JSON.parse(event.newValue ?? '{}'));
        } catch {
          /* Ignore malformed local events. */
        }
      }
    };
    let channel: BroadcastChannel | undefined;
    try {
      channel = new BroadcastChannel('codex-auth');
      channel.onmessage = (event) => {
        void receive(event.data);
      };
    } catch {
      /* storage/focus are fallbacks */
    }
    sync(true);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('storage', onStorage);
    return () => {
      channel?.close();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    if (!expiresAt || status !== 'authenticated') return;
    const timer = window.setTimeout(
      () => {
        if (document.visibilityState !== 'hidden') void useAuthStore.getState().refreshAuthState();
      },
      Math.min(2_147_000_000, Math.max(1000, expiresAt - Date.now() - 15_000)),
    );
    return () => window.clearTimeout(timer);
  }, [expiresAt, status]);

  useEffect(() => {
    let cancelled = false;
    const update = async () => {
      if (previous.current !== id) {
        const hadUser = Boolean(previous.current);
        previous.current = id;
        if (hadUser) await clearPrivateClientState();
        else
          await Promise.allSettled([
            clearUserMainProfileStore(),
            clearUserShopProfile(),
            clearPrivateWishlist(),
          ]);
      }
      if (!id || cancelled) return;
      if (
        /^\/(?:profile|shop\/(?:account-overview|checkout))/.test(path) ||
        path.startsWith('/account-overview') ||
        path === '/checkout'
      ) {
        await Promise.all([
          useUserMainProfileStore.getState().setProfileFromServer(),
          ...(!path.startsWith('/profile')
            ? [useUserShopProfile.getState().setProfileFromServer()]
            : []),
        ]);
      }
    };
    void update();
    return () => {
      cancelled = true;
    };
  }, [id, path]);
  return children ?? null;
}

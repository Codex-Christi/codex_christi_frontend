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
import { startSessionMonitor } from '@/lib/auth/session-monitor';
import { isBootstrappedAccountPath } from '@/lib/auth/session-snapshot';

export default function LoggedinProvider({ children }: { children?: ReactNode }) {
  const path = usePathname();
  const id = useAuthStore((state) => state.userSessionInfo?.user_id ?? null);
  const ownerId = useAuthStore((state) => state.accountOwnerId);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const monitor = startSessionMonitor(useAuthStore, {
      isVisible: () => document.visibilityState !== 'hidden',
      checkOnStart: !isBootstrappedAccountPath(window.location.pathname),
    });
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
    const onFocus = monitor.resume;
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
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('storage', onStorage);
    return () => {
      monitor.stop();
      channel?.close();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const update = async () => {
      if (previous.current !== ownerId) {
        const hadUser = Boolean(previous.current);
        previous.current = ownerId;
        if (hadUser) await clearPrivateClientState();
        else
          await Promise.allSettled([
            clearUserMainProfileStore(),
            clearUserShopProfile(),
            clearPrivateWishlist(),
          ]);
      }
      if (!id || cancelled) return;
      if (isBootstrappedAccountPath(path) || /^\/(?:shop\/)?checkout(?:\/|$)/.test(path)) {
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
  }, [ownerId, id, path]);
  return children ?? null;
}

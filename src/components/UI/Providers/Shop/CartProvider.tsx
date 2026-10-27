'use client';

import { useEffect } from 'react';
import useAuthStore from '@/stores/authStore';
import { connectCartLifecycle } from '@/stores/shop_stores/cartStore';
import type { CartOwner } from '@/lib/cart/types';

export default function CartProvider({ active = true }: { active?: boolean }) {
  useEffect(
    () =>
      connectCartLifecycle(
        () => {
          const { status, userSessionInfo } = useAuthStore.getState();
          const authenticated = status === 'authenticated' && Boolean(userSessionInfo?.user_id);
          const owner: CartOwner | null = authenticated
            ? `user:${userSessionInfo!.user_id}`
            : status === 'anonymous'
              ? 'guest'
              : null;
          return { owner, authenticated: authenticated && active };
        },
        (listener) => useAuthStore.subscribe(listener),
      ),
    [active],
  );
  return null;
}

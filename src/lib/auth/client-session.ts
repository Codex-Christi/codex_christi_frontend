'use client';

import { advanceAuthGeneration } from './session-generation';
import { clearUserMainProfileStore } from '@/stores/userMainProfileStore';
import { clearUserShopProfile } from '@/stores/shop_stores/use-user-shop-profile';
import { useWishlist } from '@/stores/shop_stores/use-wishlist';
import { useEditUserMainProfileStore } from '@/stores/editUserProfileStore';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { useDjangoOrderIntentStore } from '@/stores/shop_stores/checkoutStore/djangoOrderIntentStore';
import { clearLegacyCheckoutCaches } from '@/stores/shop_stores/checkoutStore/storage';
import { usePayPalIntentStore } from '@/stores/shop_stores/checkoutStore/paypalIntentStore';

export function isGuestSession(state: { accountOwnerId: string | null; status: string }) {
  return state.accountOwnerId === null && state.status === 'anonymous';
}

export async function clearPrivateClientState({ preserveGuestCheckout = false } = {}) {
  advanceAuthGeneration();
  useEditUserMainProfileStore.getState().clearEditData();
  const checkoutStores = [
    useShopCheckoutStore,
    useDjangoOrderIntentStore,
    usePayPalIntentStore,
  ];
  if (!preserveGuestCheckout) {
    useShopCheckoutStore.getState().resetCheckoutToInitial();
    useDjangoOrderIntentStore.getState().clearDjangoOrderIntent();
    usePayPalIntentStore.getState().clearActiveCheckout();
    usePayPalIntentStore.getState().clearIntent();
  }
  const removals = (preserveGuestCheckout ? [] : checkoutStores).map((store) => {
    const options = store.persist.getOptions();
    return options.name ? options.storage?.removeItem(options.name) : undefined;
  });
  await Promise.allSettled([
    clearUserMainProfileStore(),
    clearUserShopProfile(),
    clearPrivateWishlist(),
    clearLegacyCheckoutCaches(),
    ...removals,
  ]);
}

export async function clearPrivateWishlist() {
  useWishlist.getState().clearWishlist();
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem('user-wishlist');
    } catch {
      /* Legacy storage may be unavailable. */
    }
  }
}

let clientId: string | undefined;
// This only distinguishes browser tabs; it is never an authentication credential.
export const getAuthClientId = () =>
  (clientId ??=
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

export function publishSessionChange(type: 'login' | 'logout') {
  try {
    const message = { type, source: getAuthClientId(), at: Date.now() };
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('codex-auth');
      channel.postMessage(message);
      channel.close();
      return;
    }
    window.localStorage.setItem('codex-auth-event', JSON.stringify(message));
  } catch {
    /* Server cookies remain authoritative when messaging/storage is unavailable. */
  }
}

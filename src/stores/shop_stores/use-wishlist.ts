import { create } from 'zustand';
import {
  fetchUserWishlist,
  addToWishlist,
  removeFromWishlist,
  WishlistRequestError,
} from '@/lib/funcs/user-wishlist';
import errorToast from '@/lib/error-toast';
import successToast from '@/lib/success-toast';
import type { WishlistResponse } from '@/lib/wishlist/types';

interface WishlistStore {
  wishlist: WishlistResponse | null;
  isLoading: boolean;
  error: string | null;
  authRequired: boolean;
  pendingProductIds: string[];
  getWishlist: () => Promise<void>;
  addWishlistItem: (id: string) => Promise<void>;
  removeWishlistItem: (id: string) => Promise<void>;
  clearWishlist: () => void;
}

// Account data stays in memory; old sessionStorage values are never hydrated into this store.
let epoch = 0;
let requestVersion = 0;
let activeFetch: { epoch: number; version: number; promise: Promise<void> } | null = null;

function requestFailure(error: unknown) {
  return {
    error:
      error instanceof Error ? error.message : 'We could not load your wishlist. Please try again.',
    authRequired: error instanceof WishlistRequestError && error.status === 401,
  };
}

export const useWishlist = create<WishlistStore>((set, get) => {
  const mutate = async (id: string, action: 'add' | 'remove') => {
    if (get().pendingProductIds.includes(id)) return;
    const mutationEpoch = epoch;
    requestVersion += 1;
    activeFetch = null;
    set({ error: null, isLoading: false, pendingProductIds: [...get().pendingProductIds, id] });

    try {
      const result = await (action === 'add' ? addToWishlist([id]) : removeFromWishlist([id]));
      if (mutationEpoch !== epoch) return;

      // A refresh started by another mutation may describe the list before this change.
      requestVersion += 1;
      activeFetch = null;

      const current = get().wishlist;
      if (current && current.userId !== result.userId) {
        get().clearWishlist();
        await get().getWishlist();
        return;
      }
      if (action === 'remove' && current) {
        set({
          wishlist: { ...current, data: current.data.filter((item) => item.productId !== id) },
        });
      }
      set({ authRequired: false });
      successToast({ message: result.message });
      await get().getWishlist();
    } catch (error) {
      if (mutationEpoch !== epoch) return;
      const failure = requestFailure(error);
      set({ ...failure, ...(failure.authRequired ? { wishlist: null } : {}) });
      errorToast({ message: failure.error });
    } finally {
      if (mutationEpoch === epoch) {
        set({ pendingProductIds: get().pendingProductIds.filter((productId) => productId !== id) });
      }
    }
  };

  return {
    wishlist: null,
    isLoading: true,
    error: null,
    authRequired: false,
    pendingProductIds: [],

    getWishlist: () => {
      if (activeFetch?.epoch === epoch && activeFetch.version === requestVersion) {
        return activeFetch.promise;
      }
      const fetchEpoch = epoch;
      const version = ++requestVersion;
      set({ isLoading: true, error: null });
      const promise = (async () => {
        try {
          const wishlist = await fetchUserWishlist();
          if (fetchEpoch !== epoch || version !== requestVersion) return;
          set({ wishlist, isLoading: false, error: null, authRequired: false });
        } catch (error) {
          if (fetchEpoch !== epoch || version !== requestVersion) return;
          const failure = requestFailure(error);
          set({
            ...failure,
            isLoading: false,
            ...(failure.authRequired ? { wishlist: null } : {}),
          });
        } finally {
          if (activeFetch?.epoch === fetchEpoch && activeFetch.version === version)
            activeFetch = null;
        }
      })();
      activeFetch = { epoch: fetchEpoch, version, promise };
      return promise;
    },
    addWishlistItem: (id) => mutate(id, 'add'),
    removeWishlistItem: (id) => mutate(id, 'remove'),
    clearWishlist: () => {
      epoch += 1;
      requestVersion += 1;
      activeFetch = null;
      set({
        wishlist: null,
        isLoading: false,
        error: null,
        authRequired: false,
        pendingProductIds: [],
      });
    },
  };
});

import { create } from 'zustand';
import type { IUserShopProfile } from '@/lib/types/user-shop-interface';
import { readMyShopProfile } from '@/actions/account/profile';
import { getAuthGeneration } from '@/lib/auth/session-generation';
import useAuthStore from '../authStore';

interface UserShopProfile {
  userShopProfile: IUserShopProfile | null;
  isLoading: boolean;
  error: string | null;
  setUserShopProfile: (profile: IUserShopProfile | null) => void;
  clearProfile: () => void;
  setProfileFromServer: () => Promise<void>;
}
let pending: { generation: number; promise: Promise<void> } | null = null;
export const useUserShopProfile = create<UserShopProfile>((set) => ({
  userShopProfile: null,
  isLoading: true,
  error: null,
  setUserShopProfile: (userShopProfile) => set({ userShopProfile, isLoading: false, error: null }),
  clearProfile: () => set({ userShopProfile: null, isLoading: false, error: null }),
  setProfileFromServer: async () => {
    if (!useAuthStore.getState().isAuthenticated) {
      set({ userShopProfile: null, isLoading: false });
      return;
    }
    const generation = getAuthGeneration();
    if (pending?.generation === generation) return pending.promise;
    set({ isLoading: true, error: null });
    const promise = (async () => {
      const result = await readMyShopProfile().catch(() => null);
      if (getAuthGeneration() !== generation) return;
      if (!result?.success) {
        set({
          userShopProfile: null,
          isLoading: false,
          error: result && !result.success ? result.error : 'Unable to load your shop profile.',
        });
        if (result && !result.success && result.code === 'sign_in_required')
          useAuthStore.getState().setSessionState({ isAuthenticated: false, user_id: null });
        return;
      }
      set({ userShopProfile: result.data, isLoading: false, error: null });
    })().finally(() => {
      if (pending?.generation === generation) pending = null;
    });
    pending = { generation, promise };
    return promise;
  },
}));
export const clearUserShopProfile = async () => {
  useUserShopProfile.getState().clearProfile();
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem('user-shop-profile-storage');
    } catch {
      /* Storage may be blocked. */
    }
  }
};

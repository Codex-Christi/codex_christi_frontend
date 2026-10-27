import { create } from 'zustand';
import type { UserProfileDataInterface } from '@/lib/types/user-profile/main-user-profile';
import { readMyProfile } from '@/actions/account/profile';
import { getAuthGeneration } from '@/lib/auth/session-generation';
import useAuthStore from './authStore';

interface UserMainProfileStore {
  userMainProfile: UserProfileDataInterface | null;
  error: string | null;
  setUserMainProfile: (profile: UserProfileDataInterface | null) => void;
  clearProfile: () => void;
  setProfileFromServer: () => Promise<void>;
}
let pending: { generation: number; promise: Promise<void> } | null = null;
export const useUserMainProfileStore = create<UserMainProfileStore>((set) => ({
  userMainProfile: null,
  error: null,
  setUserMainProfile: (userMainProfile) => set({ userMainProfile, error: null }),
  clearProfile: () => set({ userMainProfile: null, error: null }),
  setProfileFromServer: async () => {
    const userID = useAuthStore.getState().userSessionInfo?.user_id;
    if (!userID) {
      set({ userMainProfile: null });
      return;
    }
    const generation = getAuthGeneration();
    if (pending?.generation === generation) return pending.promise;
    const promise = (async () => {
      const result = await readMyProfile().catch(() => null);
      if (getAuthGeneration() !== generation) return;
      if (!result?.success || result.data.id !== userID) {
        set({
          userMainProfile: null,
          error: result && !result.success ? result.error : 'Unable to load your profile.',
        });
        if (result && !result.success && result.code === 'sign_in_required')
          useAuthStore.getState().setSessionState({ isAuthenticated: false, user_id: null });
        return;
      }
      set({ userMainProfile: result.data, error: null });
    })().finally(() => {
      if (pending?.generation === generation) pending = null;
    });
    pending = { generation, promise };
    return promise;
  },
}));

export const clearUserMainProfileStore = async () => {
  useUserMainProfileStore.getState().clearProfile();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem('user-main-profile-storage');
    } catch {
      /* Storage may be blocked. */
    }
  }
};

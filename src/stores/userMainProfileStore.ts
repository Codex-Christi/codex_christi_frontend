import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserProfileData } from '@/lib/types/user-profile/main-user-profile';
import useNextjsStore from './useNextjsStore';

type UserMainProfileStore = {
  userMainProfile: UserProfileData | null;
  setUserMainProfile: (userMainProfile: UserProfileData | null) => void;
};

export const useUserMainProfileStore = create<UserMainProfileStore>()(
  persist(
    (set) => ({
      userMainProfile: null,
      setUserMainProfile: (userMainProfile: UserProfileData | null) =>
        set({ userMainProfile }),
    }),
    {
      name: 'user-main-profile-storage',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
export const clearUserMainProfileStore = () => {
  useUserMainProfileStore.setState({ userMainProfile: null });
  useUserMainProfileStore.persist.clearStorage();
};

export const useMainProfileStoreContents = () => {
  const userMainProfileState = useNextjsStore(
    useUserMainProfileStore,
    (state) => state
  );

  return userMainProfileState;
};

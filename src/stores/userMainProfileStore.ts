// src/stores/userMainProfileStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import CryptoJS from 'crypto-js';
import { UserProfileDataInterface } from '@/lib/types/user-profile/main-user-profile';
import { getUser } from '@/lib/funcs/userProfileFetchers/getUser';
import { getUpdatedKeys } from '@/lib/utils/getUpdatedObjKeys';

// Prevent multiple simultaneous fetches from the server (but allow future refreshes)
let inFlightUserProfilePromise: Promise<UserProfileDataInterface | null> | null = null;

const fetchUserProfileOnce = async (): Promise<UserProfileDataInterface | null> => {
  if (!inFlightUserProfilePromise) {
    inFlightUserProfilePromise = (async () => {
      try {
        return (await getUser()) ?? null;
      } catch (error) {
        console.error('Failed to fetch user profile from server:', error);
        return null;
      } finally {
        // Reset so a later call can fetch again
        inFlightUserProfilePromise = null;
      }
    })();
  }

  return inFlightUserProfilePromise;
};

const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_USER_PROFILE_DATA_ENCRYPTION_KEY!;

// === 🔐 Encryption ===
export const encrypt = (data: string) => CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
export const decrypt = (data: string) => {
  try {
    const bytes = CryptoJS.AES.decrypt(data, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    // For this store we persist an object (or null), so JSON-safe fallback should be `null`.
    return 'null';
  }
};

/**
 * Encrypted JSON storage for zustand persist.
 * Uses localStorage by default (persists across browser restarts) and falls back to a no-op storage during SSR.
 */
const createEncryptedStorage = <S>(opts: {
  encrypt: (plain: string) => string;
  decrypt: (cipher: string) => string;
  storage?: Storage;
}) => {
  const noop: StateStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };

  return createJSONStorage<S>(() => {
    const base: Storage | null =
      opts.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);

    if (!base) return noop;

    return {
      getItem: (name) => {
        const raw = base.getItem(name);
        if (!raw) return null;
        try {
          return opts.decrypt(raw);
        } catch {
          return null;
        }
      },
      setItem: (name, value) => {
        try {
          base.setItem(name, opts.encrypt(value));
        } catch {
          // ignore write failures (quota, disabled storage, etc.)
        }
      },
      removeItem: (name) => {
        try {
          base.removeItem(name);
        } catch {
          // ignore
        }
      },
    } as StateStorage;
  });
};

interface UserMainProfileStore {
  userMainProfile: UserProfileDataInterface | null;
  setUserMainProfile: (userMainProfile: UserProfileDataInterface | null) => void;
  clearProfile: () => void;
  setProfileFromServer: () => Promise<void>;
}

// This store persists the user profile data in localStorage and encrypts it.
export const useUserMainProfileStore = create<UserMainProfileStore>()(
  persist(
    (set, get) => ({
      userMainProfile: null,

      setProfileFromServer: async () => {
        const serverData = await fetchUserProfileOnce();

        if (!serverData) return;

        const storeData = get().userMainProfile;

        // If there is no data in the store yet, just set it once
        if (!storeData) {
          set({ userMainProfile: serverData });
          return;
        }

        // Only update when there are actual changes between server and store
        const updatedKeys = getUpdatedKeys(serverData, storeData);

        if (Object.keys(updatedKeys).length > 0) {
          set({ userMainProfile: serverData });
        }
      },

      setUserMainProfile: (userMainProfile) => set({ userMainProfile }),

      clearProfile: () => set({ userMainProfile: null }),
    }),
    {
      name: 'user-main-profile-storage',
      storage: createEncryptedStorage<UserMainProfileStore>({ encrypt, decrypt }),
      // Skip initial hydration on the server; we'll trigger rehydrate on the client.
    },
  ),
);

export const clearUserMainProfileStore = () => {
  const { clearProfile } = useUserMainProfileStore.getState();
  clearProfile();
  useUserMainProfileStore.persist.clearStorage();
};

// src/stores/userMainProfileStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import CryptoJS from 'crypto-js';
import { UserProfileDataInterface } from '@/lib/types/user-profile/main-user-profile';
import { getUser } from '@/lib/funcs/userProfileFetchers/getUser';
import { getUpdatedKeys } from '@/lib/utils/getUpdatedObjKeys';

// Prevent multiple simultaneous fetches from the server
let inFlightUserProfilePromise: Promise<UserProfileDataInterface | null> | null = null;

const fetchUserProfileOnce = async (): Promise<UserProfileDataInterface | null> => {
  if (!inFlightUserProfilePromise) {
    inFlightUserProfilePromise = getUser()
      .then((result) => result ?? null)
      .catch((error) => {
        console.error('Failed to fetch user profile from server:', error);
        // Reset so a later call can retry
        inFlightUserProfilePromise = null;
        return null;
      });
  }

  return inFlightUserProfilePromise;
};

const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_USER_PROFILE_DATA_ENCRYPTION_KEY!;

// === 🔐 Encryption ===
const encryptData = (data: UserProfileDataInterface | null): string => {
  if (!data) return '';
  const jsonData = JSON.stringify(data);
  return CryptoJS.AES.encrypt(jsonData, ENCRYPTION_KEY).toString();
};

// === 🔓 Decryption ===
const decryptData = (encryptedData: string): UserProfileDataInterface | null => {
  if (!encryptedData) return null;
  const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
  const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
  return JSON.parse(decryptedData);
};

interface UserMainProfileStore {
  userMainProfile: UserProfileDataInterface | null;
  setUserMainProfile: (userMainProfile: UserProfileDataInterface | null) => void;
  clearProfile: () => void;
  setProfileFromServer: () => Promise<void>;
}

// Type guard function to check if value is UserProfileData
function isUserProfileData(value: {
  id?: string;
  email?: string;
}): value is UserProfileDataInterface {
  return value && typeof value.id === 'string' && typeof value.email === 'string';
}

// Persisted store for user main profile
// This store will persist the user profile data in session storage and encrypt it for security.
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

        const isDataDifferent = Object.values(updatedKeys).length > 0;

        if (isDataDifferent) {
          set({ userMainProfile: serverData });
        }
      },

      setUserMainProfile: (userMainProfile: UserProfileDataInterface | null) =>
        set((state) => ({ ...state, userMainProfile })),

      clearProfile: () => set({ userMainProfile: null }),
    }),
    {
      name: 'user-main-profile-storage',
      storage: createJSONStorage(() => sessionStorage, {
        replacer: (key, value) => {
          // Serialize and encrypt before saving
          if (key === 'userMainProfile' && value) {
            if (isUserProfileData(value)) {
              return encryptData(value);
            } else {
              console.error('Invalid data type for userMainProfile:', value);
            }
          }
          return value;
        },
        reviver: (key, value) => {
          // Decrypt and deserialize when loading
          if (key === 'userMainProfile' && value) {
            return typeof value === 'string' ? decryptData(value) : null;
          }
          return value;
        },
      }),
      // Skip initial hydration on the server; we'll trigger rehydrate on the client.
    },
  ),
);

export const clearUserMainProfileStore = () => {
  useUserMainProfileStore.getState().clearProfile();
  useUserMainProfileStore.persist.clearStorage();
};

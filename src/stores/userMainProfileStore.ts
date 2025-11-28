import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserProfileDataInterface } from '@/lib/types/user-profile/main-user-profile';
import CryptoJS from 'crypto-js';
import { PersistedStorageWithRehydration } from '@/lib/types/general_store_interfaces';
import { getUser } from '@/lib/funcs/userProfileFetchers/getUser';
import { getUpdatedKeys } from '@/lib/utils/getUpdatedObjKeys';

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

interface UserMainProfileStore extends PersistedStorageWithRehydration {
  userMainProfile: UserProfileDataInterface | null;
  setUserMainProfile: (userMainProfile: UserProfileDataInterface | null) => void;
  clearProfile: () => void;
  setProfileFromServer: () => Promise<void>;
}

// Persisted store for user main profile
// This store will persist the user profile data in session storage
// and encrypt it for security.
export const useUserMainProfileStore = create<UserMainProfileStore>()(
  persist(
    (set, get) => ({
      userMainProfile: null, // Fetch user profile data on initialization
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
      _hydrated: false,
      hydrate: () => set({ _hydrated: true }),
    }),
    {
      name: 'user-main-profile-storage',
      storage: createJSONStorage(() => sessionStorage, {
        replacer: (key, value) => {
          // Serialize and Encrypt before saving
          if (key === 'userMainProfile' && value) {
            // Type guard to ensure value is of type UserProfileData
            if (isUserProfileData(value)) {
              return encryptData(value);
            } else {
              console.error('Invalid data type for userMainProfile:', value);
            }
          }
          return value; // Return the value unchanged if no conditions are met
        },
        reviver: (key, value) => {
          // Decrypt and Deserialize when loading
          if (key === 'userMainProfile' && value) {
            return typeof value === 'string' ? decryptData(value) : null;
          }
          return value;
        },
      }),
      skipHydration: true,
      // Skip initial hydration to avoid  loading encrypted data  on server-side
      onRehydrateStorage: () => (state) => {
        state?.hydrate();

        // Only sync from the server if we don't have a profile yet.
        if (state && !state.userMainProfile) {
          state
            .setProfileFromServer()
            .catch((error) => console.error('Failed to sync user profile on rehydrate:', error));
        }
      },
    },
  ),
);

export const clearUserMainProfileStore = () => {
  useUserMainProfileStore.getState().clearProfile();
  useUserMainProfileStore.persist.clearStorage();
};

// Type guard function to check if value is UserProfileData
function isUserProfileData(value: {
  id?: string;
  email?: string;
}): value is UserProfileDataInterface {
  return value && typeof value.id === 'string' && typeof value.email === 'string';
}

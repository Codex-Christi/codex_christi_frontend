import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { UserProfileDataInterface } from '@/lib/types/user-profile/main-user-profile';
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY =
  process.env.NEXT_PUBLIC_USER_PROFILE_DATA_ENCRYPTION_KEY!;

// === 🔐 Encryption ===
const encryptData = (data: UserProfileDataInterface | null): string => {
  if (!data) return '';
  const jsonData = JSON.stringify(data);
  return CryptoJS.AES.encrypt(jsonData, ENCRYPTION_KEY).toString();
};

// === 🔓 Decryption ===
const decryptData = (
  encryptedData: string
): UserProfileDataInterface | null => {
  if (!encryptedData) return null;
  const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
  const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
  return JSON.parse(decryptedData);
};

type UserMainProfileStore = {
  userMainProfile: UserProfileDataInterface | null;
  setUserMainProfile: (
    userMainProfile: UserProfileDataInterface | null
  ) => void;
};

// Persisted store for user main profile
// This store will persist the user profile data in session storage
// and encrypt it for security.
export const useUserMainProfileStore = create<UserMainProfileStore>()(
  persist(
    (set) => ({
      userMainProfile: null,
      setUserMainProfile: (userMainProfile: UserProfileDataInterface | null) =>
        set((state) => ({ ...state, userMainProfile })),
      clearProfile: () => set({ userMainProfile: null }),
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
    }
  )
);
export const clearUserMainProfileStore = () => {
  useUserMainProfileStore.setState({ userMainProfile: null });
  useUserMainProfileStore.persist.clearStorage();
};

// Type guard function to check if value is UserProfileData
function isUserProfileData(value: {
  id?: string;
  email?: string;
}): value is UserProfileDataInterface {
  return (
    value && typeof value.id === 'string' && typeof value.email === 'string'
  );
}

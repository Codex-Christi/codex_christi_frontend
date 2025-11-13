import CryptoJS from 'crypto-js';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { PersistedStorageWithRehydration } from '@/lib/types/general_store_interfaces';
import { fetchUserShopProfile } from '@/lib/funcs/user-shop';
import { getUpdatedKeys } from '@/lib/utils/getUpdatedObjKeys';
import { IUserShopProfile } from '@/lib/types/user-shop-interface';

const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_USER_PROFILE_DATA_ENCRYPTION_KEY!;

// === 🔐 Encryption ===
const encryptData = (data: IUserShopProfile | null): string => {
  if (!data) return '';
  const jsonData = JSON.stringify(data);
  return CryptoJS.AES.encrypt(jsonData, ENCRYPTION_KEY).toString();
};

// === 🔓 Decryption ===
const decryptData = (encryptedData: string): IUserShopProfile | null => {
  if (!encryptedData) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedData);
  } catch {
    return null;
  }
};

interface UserShopProfile extends PersistedStorageWithRehydration {
  userShopProfile: IUserShopProfile | null;
  isLoading: boolean;
  setUserShopProfile: (userShopProfile: IUserShopProfile | null) => void;
  clearProfile: () => void;
  setProfileFromServer: () => Promise<void>;
}

export const useUserShopProfile = create<UserShopProfile>()(
  persist(
    (set, get) => {
      return {
        userShopProfile: null,
        isLoading: true,
        _hydrated: false,

        setProfileFromServer: async () => {
          const storeData = get().userShopProfile;

          try {
            const serverData = await fetchUserShopProfile();

            // If no server data, return early
            if (!serverData) {
              set({ isLoading: false });
              return;
            }

            // If no data is present in the store, fetch from server
            // This is to ensure that the store is initialized with the latest data
            if (!storeData) {
              set({ userShopProfile: serverData, isLoading: false });
              return;
            }

            // Check if the data has changed before updating the store
            const updatedKeys = getUpdatedKeys(serverData, storeData);
            const isDataDifferent = Object.values(updatedKeys).length > 0;

            if (isDataDifferent) {
              set({ userShopProfile: serverData, isLoading: false });
            } else {
              set({ isLoading: false });
            }
          } catch {
            set({ isLoading: false });
          }
        },

        setUserShopProfile: (userShopProfile: IUserShopProfile | null) => set({ userShopProfile }),

        clearProfile: () => set({ userShopProfile: null, isLoading: false }),

        hydrate: () => set({ _hydrated: true }),
      };
    },
    {
      name: 'user-shop-profile-storage',
      storage: createJSONStorage(() => sessionStorage, {
        replacer: (key, value) => {
          // Serialize and Encrypt before saving
          if (key === 'userShopProfile' && value) {
            if (isUserShopProfileData(value as unknown as IUserShopProfile)) {
              return encryptData(value as unknown as IUserShopProfile);
            }
          }
          return value;
        },
        reviver: (key, value) => {
          // Decrypt and Deserialize when loading
          if (key === 'userShopProfile' && value) {
            return typeof value === 'string' ? decryptData(value) : null;
          }
          return value;
        },
      }),
      onRehydrateStorage: () => async (state) => {
        state?.hydrate();
        await state?.setProfileFromServer();
      },
    },
  ),
);

// Auto-rehydrate on store creation (client-side only)
if (typeof window !== 'undefined') {
  useUserShopProfile.persist.rehydrate();
}

export const clearUserShopProfile = () => {
  useUserShopProfile.getState().clearProfile();
  useUserShopProfile.persist.clearStorage();
};

// Type guard function - Fixed to check the correct structure
function isUserShopProfileData(value: IUserShopProfile): value is IUserShopProfile {
  if (!value || typeof value !== 'object') return false;

  // Check if it has a data property with the required fields
  if (!value.data || typeof value.data !== 'object') return false;

  const requiredFields: (keyof IUserShopProfile['data'])[] = [
    'first_name',
    'last_name',
    'bio',
    'profile_pic',
    'username',
    'favorite_products',
    'payment_methods',
    'shipping_address',
    'shipping_city',
    'shipping_state',
    'shipping_country',
  ];

  return requiredFields.every((field) => field in value.data);
}

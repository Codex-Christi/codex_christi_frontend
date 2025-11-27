import CryptoJS from 'crypto-js';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { PersistedStorageWithRehydration } from '@/lib/types/general_store_interfaces';
import { fetchUserWishlist, addToWishlist, removeFromWishlist } from '@/lib/funcs/user-wishlist';
import { getUpdatedKeys } from '@/lib/utils/getUpdatedObjKeys';

interface IWishlist {
  status: number;
  success: boolean;
  message: string;
  data: Record<string, string | number | boolean>[];
}

const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_USER_PROFILE_DATA_ENCRYPTION_KEY!;

// === 🔐 Encryption ===
const encryptData = (data: IWishlist | null): string => {
  if (!data) return '';
  const jsonData = JSON.stringify(data);
  return CryptoJS.AES.encrypt(jsonData, ENCRYPTION_KEY).toString();
};

// === 🔓 Decryption ===
const decryptData = (encryptedData: string): IWishlist | null => {
  if (!encryptedData) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedData);
  } catch {
    return null;
  }
};

// ✅ Define the shape of your Zustand store
interface WishlistStore extends PersistedStorageWithRehydration {
  wishlist: IWishlist | null;
  isLoading: boolean;
  getWishlist: () => Promise<void>;
  addWishlistItem: (id: string) => Promise<void>;
  removeWishlistItem: (id: string) => Promise<void>;
  setWishlist: (wishlist: IWishlist | null) => void;
  clearWishlist: () => void;
}

export const useWishlist = create<WishlistStore>()(
  persist(
    (set, get) => ({
      wishlist: null,
      isLoading: true,
      _hydrated: false,

      getWishlist: async () => {
        const storeData = get().wishlist;

        try {
          const serverData = await fetchUserWishlist();

          if (!serverData) {
            set({ isLoading: false });
            return;
          }

          if (!storeData) {
            set({ wishlist: serverData, isLoading: false });
            return;
          }

          const updatedKeys = getUpdatedKeys(serverData, storeData);
          const isDataDifferent = Object.values(updatedKeys).length > 0;

          set({ wishlist: isDataDifferent ? serverData : storeData, isLoading: false });
        } catch {
          set({ isLoading: false });
        }
      },

      addWishlistItem: async (productId: string) => {
        const data = await addToWishlist([productId]);
        if (data?.success) await get().getWishlist();
      },

      removeWishlistItem: async (productId: string) => {
        const data = await removeFromWishlist([productId]);
        if (data?.success) await get().getWishlist();
      },

      setWishlist: (wishlist: IWishlist | null) => set({ wishlist }),

      clearWishlist: () => set({ wishlist: null, isLoading: false }),

      hydrate: () => set({ _hydrated: true }),
    }),
    {
      name: 'user-wishlist',
      storage: createJSONStorage(() => sessionStorage, {
        replacer: (key, value) => {
          if (key === 'wishlist' && value && isWishlistData(value as IWishlist)) {
            return encryptData(value as IWishlist);
          }
          return value;
        },
        reviver: (key, value) => {
          if (key === 'wishlist' && typeof value === 'string') {
            return decryptData(value);
          }
          return value;
        },
      }),
      onRehydrateStorage: () => async (state) => {
        state?.hydrate();
        await state?.getWishlist();
      },
    },
  ),
);

// Auto-rehydrate on store creation (client-side only)
if (typeof window !== 'undefined') {
  useWishlist.persist.rehydrate();
}

export const clearWishlistStorage = () => {
  useWishlist.getState().clearWishlist();
  useWishlist.persist.clearStorage();
};

// ✅ Proper type guard
function isWishlistData(value: unknown): value is IWishlist {
  if (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'success' in value &&
    'message' in value &&
    'data' in value
  ) {
    return true;
  }
  return false;
}

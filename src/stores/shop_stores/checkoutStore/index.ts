import { encrypt, decrypt } from '../cartStore';
import { UserProfileDataInterface } from '@/lib/types/user-profile/main-user-profile';
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';
import { create } from 'zustand';
import { persist, PersistStorage, StorageValue } from 'zustand/middleware';

type CheckoutPickType = Pick<UserProfileDataInterface, 'first_name' | 'last_name' | 'email'>;
export interface ShopCheckoutStoreInterface extends CheckoutPickType {
  payment_method: {
    payment_method: 'credit_card' | '';
    name: string;
    card_number: string;
    expiry_date: string;
    card_holder_name: string;
    paypal_email: string;
    google_account_email: string;
  } | null;
  delivery_address: {
    shipping_address_line_1: string | null;
    shipping_address_line_2: string | null;
    shipping_city: string | null;
    shipping_state: string | null;
    shipping_country: string | null;
    zip_code: string | null;
  };
}

export interface ShopCheckoutState extends ShopCheckoutStoreInterface {
  setFirstName: (first_name: ShopCheckoutStoreInterface['first_name']) => void;
  setLastName: (last_name: ShopCheckoutStoreInterface['last_name']) => void;
  setEmail: (email: ShopCheckoutStoreInterface['email']) => void;
  setPaymentMehod: (payment_method: ShopCheckoutStoreInterface['payment_method']) => void;
  setDeliveryAddress: (delivery_address: ShopCheckoutStoreInterface['delivery_address']) => void;
}

interface EncryptedStorageOptions {
  encrypt: (data: string) => string;
  decrypt: (data: string) => string;
}

export const createEncryptedStorage = <S>({
  encrypt,
  decrypt,
}: EncryptedStorageOptions): PersistStorage<S> => ({
  getItem: (name) => {
    try {
      const encrypted = localStorage.getItem(name);
      if (!encrypted) return null;
      const decrypted = decrypt(encrypted);
      return JSON.parse(decrypted) as StorageValue<S>;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      const stringified = JSON.stringify(value);
      const encrypted = encrypt(stringified);
      localStorage.setItem(name, encrypted);
    } catch {
      // Handle error appropriately
    }
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
  },
});

const initialObj = {
  first_name: '',
  last_name: '',
  email: '',
  payment_method: null,
  delivery_address: {
    shipping_address_line_1: null,
    shipping_address_line_2: null,
    shipping_city: null,
    shipping_state: null,
    shipping_country: null,
    zip_code: null,
  },
};

export const useShopCheckoutStore = create<ShopCheckoutState>()(
  // Hooks
  // const {userMainProfile} = useUserMainProfileStore((state)=>state)

  persist(
    (set) => ({
      ...initialObj,
      first_name: useUserMainProfileStore.getState().userMainProfile?.first_name,
      last_name: useUserMainProfileStore.getState().userMainProfile?.last_name,
      email: useUserMainProfileStore.getState().userMainProfile?.email,
      payment_method: null,
      setFirstName: (first_name) => set({ first_name }),
      setLastName: (last_name) => set({ last_name }),
      setEmail: (email) => set({ email }),
      setPaymentMehod: (payment_method) => set({ payment_method }),
      setDeliveryAddress: (delivery_address) => set({ delivery_address }),
      clearCheckout: () => {
        set({
          ...initialObj,
          first_name: useUserMainProfileStore.getState().userMainProfile?.first_name,
          last_name: useUserMainProfileStore.getState().userMainProfile?.last_name,
          email: useUserMainProfileStore.getState().userMainProfile?.email,
          payment_method: null,
        });
        localStorage.removeItem('checkout-storage');
      },
    }),
    {
      name: 'checkout-storage',
      storage: createEncryptedStorage<ShopCheckoutState>({ encrypt, decrypt }),
      skipHydration: true,
    },
  ),
);

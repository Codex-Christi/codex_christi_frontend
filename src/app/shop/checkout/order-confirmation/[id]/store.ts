import { SuccessResponse } from '@/actions/shop/paypal/processCompletedTx';
import { decrypt, encrypt } from '@/stores/shop_stores/cartStore';
import { createEncryptedStorage } from '@/stores/shop_stores/checkoutStore';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OrderConfirmationStoreInterface
  extends Omit<SuccessResponse, 'success' | 'status' | 'serverData'> {
  setPaymentConfirmation: (data: SuccessResponse) => void;
  serverData: SuccessResponse['serverData'] | undefined;
}

export const useOrderConfirmationStore = create<OrderConfirmationStoreInterface>()(
  persist(
    (set) => ({
      pdfLink: '',
      authData: undefined,
      capturedOrder: undefined,
      serverData: undefined,
      fileName: '',

      setPaymentConfirmation: (data) => {
        set({
          ...data,
        });
      },
    }),
    {
      name: 'order-confirmation-store',
      storage: createEncryptedStorage<OrderConfirmationStoreInterface>({ encrypt, decrypt }),
    },
  ),
);

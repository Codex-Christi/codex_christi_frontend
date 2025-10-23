import { SuccessResponse } from '@/actions/shop/paypal/processAndUploadCompletedTx';
import { decrypt, encrypt } from '@/stores/shop_stores/cartStore';
import { createEncryptedStorage } from '@/stores/shop_stores/checkoutStore';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OrderConfirmationStoreInterface
  extends Omit<SuccessResponse, 'success' | 'status' | 'paymentJSONData'> {
  setPaymentConfirmation: (data: SuccessResponse) => void;
  paymentJSONData: SuccessResponse['paymentJSONData'] | undefined;
}

export const useOrderConfirmationStore = create<OrderConfirmationStoreInterface>()(
  persist(
    (set) => ({
      pdfLink: '',
      authData: undefined,
      capturedOrder: undefined,
      paymentJSONData: undefined,
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

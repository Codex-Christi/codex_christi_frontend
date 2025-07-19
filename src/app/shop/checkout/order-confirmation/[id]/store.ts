import { SuccessResponse } from '@/actions/shop/paypal/processCompletedTx';
import { decrypt, encrypt } from '@/stores/shop_stores/cartStore';
import { createEncryptedStorage } from '@/stores/shop_stores/checkoutStore';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PaymentConfirmationStoreInterface
  extends Omit<SuccessResponse, 'success' | 'status' | 'serverData'> {
  setPaymentConfirmation: (data: SuccessResponse) => void;
  serverData: SuccessResponse['serverData'] | undefined;
}

export const usePaymentConfirmationStore = create<PaymentConfirmationStoreInterface>()(
  persist(
    (set) => ({
      pdfLink: '',
      authData: undefined,
      capturedOrder: undefined,
      serverData: undefined,

      setPaymentConfirmation: (data) => {
        set({
          pdfLink: data.pdfLink,
          authData: data.authData,
          capturedOrder: data.capturedOrder,
          serverData: data.serverData,
        });
      },
    }),
    {
      name: 'payment-confirmation-store',
      storage: createEncryptedStorage<PaymentConfirmationStoreInterface>({ encrypt, decrypt }),
    },
  ),
);

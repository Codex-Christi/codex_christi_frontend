import { ReceiptUploadSuccessResponse } from '@/lib/hooks/shopHooks/checkout/usePost-PaymentProcessors';
import { decrypt, encrypt } from '@/stores/shop_stores/cartStore';
import { createEncryptedStorage } from '@/stores/shop_stores/checkoutStore';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OrderConfirmationStoreInterface {
  setPaymentConfirmation: (data: Omit<ReceiptUploadSuccessResponse, 'success'> | undefined) => void;
  paymentJSONData: Omit<ReceiptUploadSuccessResponse, 'success'> | undefined;
}

export const useOrderConfirmationStore = create<OrderConfirmationStoreInterface>()(
  persist(
    (set) => ({
      paymentJSONData: {
        pdfReceiptLink: '',
        receiptFileName: '',
      },

      setPaymentConfirmation: (data) => {
        if (data?.pdfReceiptLink && data.receiptFileName) set({ paymentJSONData: { ...data } });
      },
    }),
    {
      name: 'order-confirmation-store',
      storage: createEncryptedStorage<OrderConfirmationStoreInterface>({ encrypt, decrypt }),
    },
  ),
);

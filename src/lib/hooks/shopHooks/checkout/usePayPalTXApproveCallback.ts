import { useCallback, useState } from 'react';
import type { OnApproveData } from '@paypal/paypal-js';
import errorToast from '@/lib/error-toast';
import {
  isCurrentCheckoutAttempt,
  usePayPalIntentStore,
} from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import { useShopRouter } from '@/lib/hooks/useShopRouter';
import { finalizePayPalAttempt, PayPalCheckoutError } from './finalizePayPalAttempt';

export const usePayPalTXApproveCallback = (onFailure?: (message: string) => void) => {
  const { push } = useShopRouter();
  const [isFinalizingPayment, setIsFinalizingPayment] = useState(false);
  const attempt = usePayPalIntentStore((state) => state.checkoutAttempt);
  const mainPayPalApproveCallback = useCallback(
    async (data: OnApproveData) => {
      if (!attempt || !isCurrentCheckoutAttempt(attempt)) return;
      setIsFinalizingPayment(true);
      try {
        await finalizePayPalAttempt(attempt, data.orderID, {
          onCompleted: (token) => push(`/shop/checkout/confirmation/${encodeURIComponent(token)}`),
        });
      } catch (error) {
        if (isCurrentCheckoutAttempt(attempt)) {
          const message =
            error instanceof PayPalCheckoutError
              ? error.message
              : 'We could not confirm this payment. Check its status before trying again.';
          if (onFailure) onFailure(message);
          else errorToast({ message });
        }
      } finally {
        setIsFinalizingPayment(false);
      }
    },
    [attempt, onFailure, push],
  );
  return { isFinalizingPayment, mainPayPalApproveCallback };
};

import { ServerOrderDetailsContext } from '@/components/UI/Shop/Checkout/ServerOrderDetailsComponent';
import errorToast from '@/lib/error-toast';
import { encrypt, useCartStore } from '@/stores/shop_stores/cartStore';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { useOrderStringStore } from '@/stores/shop_stores/checkoutStore/ORD-stringStore';
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';
import { OnApproveData, OrderResponseBody } from '@paypal/paypal-js';
import { OrdersCapture } from '@paypal/paypal-server-sdk';
import { startTransition, useCallback, useContext, useEffect } from 'react';
import { usePost_PaymentProcessors } from './usePost-PaymentProcessors';
import { useServerActionWithState } from '../../useServerActionWithState';
import { FetcherError } from '@/lib/utils/SWRfetcherAdvanced';

// Main Hook
export const usePayPalTXApproveCallback = () => {
  // Top-level hook initializations
  const cart = useCartStore((store) => store.variants);
  const serverOrderDetails = useContext(ServerOrderDetailsContext);
  const userId = useUserMainProfileStore((state) => state.userMainProfile?.id);
  const { first_name, last_name, email, delivery_address } = useShopCheckoutStore((state) => state);
  const ORD_string = useOrderStringStore((s) => s.orderString);

  const { uploadPaymentReceipt, savePaymentTXToBackend } = usePost_PaymentProcessors();

  const {
    result: receiptUploadRes,
    call: uploadReceipt,
    isPending: isReceiptUploadPending,
  } = useServerActionWithState(uploadPaymentReceipt, null);

  const {
    result: paymentSaveRes,
    call: savePaymentDataToBackend,
    isPending: isPaymentSavePending,
  } = useServerActionWithState(savePaymentTXToBackend, null);

  // Destructuring
  const { countrySupport } = serverOrderDetails || {};
  const { country_iso2 } = countrySupport?.country || {};

  // Main completion callback
  const mainPayPalApproveCallback = useCallback(
    async (data: OnApproveData): Promise<void> => {
      try {
        const authRes = await fetch('/next-api/paypal/orders/authorize', {
          method: 'POST',
          body: JSON.stringify({ orderID: data.orderID }),
        });

        //Object from paypal on authorize
        const authData = JSON.parse(await authRes.json()) as OrderResponseBody;

        const authorizationId = authData?.purchase_units?.[0]?.payments?.authorizations?.[0]?.id;

        if (!authorizationId) {
          errorToast({ message: 'Missing authorization ID' });
          return;
        }

        const capRes = await fetch('/next-api/paypal/orders/capture', {
          method: 'POST',
          body: JSON.stringify({ authorizationId }),
        });

        //Final capturedOrder data
        const capturedOrder = JSON.parse(await capRes.json()) as OrdersCapture;

        if (capturedOrder?.status === 'COMPLETED') {
          // Process all post-payment server actions
          // Server action that'll process the receipt upload
          const rrr = await uploadReceipt(
            encrypt(
              JSON.stringify({
                authData,
                customer: {
                  name: `${first_name} ${last_name}`,
                  email: email ?? 'john@example.com',
                },
                ORD_string,
              }),
            ),
          );
          console.log(capturedOrder);

          console.log(rrr);

          // please encrypt authData, finalCapturedOrder, 'capturedOrderPaypalID', customer, delivery_address, userId, ORD_string, pdfReceiptLink, receiptFileName,

          //If everything goes well in submitting the processed order's details to the backend
          //   if (res.success === true) {
          //     setPaymentConfirmationData(res);
          //     successToast({
          //       message: `Transaction complete: ${capturedOrder.id},`,
          //       header: 'Payment Successfull!',
          //     });

          //     router.push(`/shop/checkout/order-confirmation/${capturedOrder.id}`);
          //   }
          //   // Else if the uploading fails
          //   else {
          //     errorToast({ header: `Payment details upload failed`, message: res.message });
          //   }

          // If payment capture fails for some reason
        } else {
          throw new Error(`Capture failed`);
        }
      } catch (err: Error | FetcherError | unknown) {
        console.log(err);

        errorToast({
          message:
            err instanceof Error
              ? err.message
              : err instanceof FetcherError
                ? `info - ${err.info}, cause - ${err.cause}, message - ${err.message}`
                : String(err),
        });
        throw new Error('Failed to create PayPal order');
      }
    },
    [ORD_string, email, first_name, last_name, receiptUploadRes, uploadReceipt],
  );

  return {
    mainPayPalApproveCallback,
    isReceiptUploadPending,
    isReceiptUploadSuccess: receiptUploadRes?.ok,
  };
};

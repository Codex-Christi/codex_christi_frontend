import { useCallback, useContext } from 'react';
import { ServerOrderDetailsContext } from '@/components/UI/Shop/Checkout/ServerOrderDetailsComponent';
import { useCartStore, encrypt } from '@/stores/shop_stores/cartStore';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { useOrderStringStore } from '@/stores/shop_stores/checkoutStore/ORD-stringStore';
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';
import { OnApproveData, OrderResponseBody } from '@paypal/paypal-js';
import { OrdersCapture } from '@paypal/paypal-server-sdk';
import { usePost_PaymentProcessors } from './usePost-PaymentProcessors';
import { useServerActionWithState } from '../../useServerActionWithState';
import { FetcherError } from '@/lib/utils/SWRfetcherAdvanced';
import successToast from '@/lib/success-toast';
import errorToast from '@/lib/error-toast';

// 🧩 Main Hook
export const usePayPalTXApproveCallback = () => {
  const cart = useCartStore((s) => s.variants);
  const { userMainProfile } = useUserMainProfileStore();
  const userId = userMainProfile?.id;
  const { first_name, last_name, email, delivery_address } = useShopCheckoutStore();
  const ORD_string = useOrderStringStore((s) => s.orderString);
  const serverOrderDetails = useContext(ServerOrderDetailsContext);

  const { uploadPaymentReceipt, savePaymentTXToBackend, pushOrderToMerchize } =
    usePost_PaymentProcessors();

  // Controlled async server actions
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

  const {
    result: orderPushRes,
    call: pushOrderToMerchizeClient,
    isPending: isOrderPushPending,
  } = useServerActionWithState(pushOrderToMerchize, null);

  const country_iso2 = serverOrderDetails?.countrySupport?.country?.country_iso2;

  // 💳 Main PayPal Approve Callback
  const mainPayPalApproveCallback = useCallback(
    async (data: OnApproveData) => {
      try {
        // 1️⃣ Authorize PayPal Order

        const authRes = await fetch('/next-api/paypal/orders/authorize', {
          method: 'POST',
          body: JSON.stringify({ orderID: data.orderID }),
        });
        if (!authRes.ok) throw new Error(`Authorization failed: ${authRes.statusText}`);

        const authData = JSON.parse(await authRes.json()) as OrderResponseBody;
        const authorizationId = authData?.purchase_units?.[0]?.payments?.authorizations?.[0]?.id;
        if (!authorizationId) throw new Error('Missing authorization ID');

        // 2️⃣ Capture Payment

        const capRes = await fetch('/next-api/paypal/orders/capture', {
          method: 'POST',
          body: JSON.stringify({ authorizationId }),
        });
        if (!capRes.ok) throw new Error(`Capture failed: ${capRes.statusText}`);

        const capturedOrder = JSON.parse(await capRes.json()) as OrdersCapture;
        if (capturedOrder?.status !== 'COMPLETED')
          throw new Error(`Payment not completed: ${capturedOrder?.status}`);

        // 3️⃣ Upload Payment Receipt
        const receiptPayload = encrypt(
          JSON.stringify({
            authData,
            customer: { name: `${first_name} ${last_name}`, email: email ?? 'john@example.com' },
            ORD_string,
          }),
        );

        const receiptResp = await uploadReceipt(receiptPayload);
        if (!receiptResp?.ok) {
          errorToast({
            header: 'Payment details upload failed',
            message: receiptResp?.error?.message ?? 'Error occurred during receipt upload',
          });
          return;
        }

        successToast({
          header: 'Payment Successful!',
          message: `Transaction complete: ${capturedOrder.id}`,
        });

        // 4️⃣ Save Payment to Backend
        const { pdfReceiptLink, receiptFileName } = receiptResp;
        const paymentSavePayload = encrypt(
          JSON.stringify({
            authData,
            finalCapturedOrder: capturedOrder,
            capturedOrderPaypalID: capturedOrder.id,
            customer: { name: `${first_name} ${last_name}`, email },
            delivery_address,
            userId,
            ORD_string,
            pdfReceiptLink,
            receiptFileName,
          }),
        );

        const paymentResp = await savePaymentDataToBackend(paymentSavePayload);

        console.log(paymentResp);

        if (!paymentResp?.ok) {
          errorToast({
            header: 'Payment Save Failed',
            message: paymentResp?.error?.message ?? 'Could not save payment record',
          });
          return;
        }

        // 5️⃣ Push Order to Merchize
        const orderVariants = cart.map(({ quantity, variantId }) => ({ quantity, variantId }));
        const orderRecipientInfo = {
          delivery_address,
          customer: { name: `${first_name} ${last_name}`, email },
        };
        const merchizePayload = encrypt(
          JSON.stringify({ orderVariants, orderRecipientInfo, ORD_string, country_iso2 }),
        );

        const pushRes = await pushOrderToMerchizeClient(merchizePayload);

        console.log(pushRes);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : err instanceof FetcherError
              ? `info: ${err.info}, cause: ${err.cause}`
              : String(err);

        console.log(err);

        console.error('PayPal approval error:', err);
        errorToast({ message });
        // throw new Error('Failed to complete PayPal order');
      }
    },
    //prettier-ignore
    [ cart, country_iso2, delivery_address, email, first_name, last_name, uploadReceipt, savePaymentDataToBackend, pushOrderToMerchizeClient, ORD_string, userId, ],
  );

  return {
    mainPayPalApproveCallback,
    isReceiptUploadPending,
    isReceiptUploadSuccess: receiptUploadRes?.ok,
    isPaymentSavePending,
    isPaymentSaveSuccessfull: paymentSaveRes?.ok,
    paymentSaveRes,
    orderPushRes,
    isOrderPushPending,
  };
};

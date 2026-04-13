import { useCallback, useContext, useMemo } from 'react';
import { ServerOrderDetailsContext } from '@/components/UI/Shop/Checkout/ServerOrderDetailsComponent';
import { useCartStore } from '@/stores/shop_stores/cartStore';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { useOrderStringStore } from '@/stores/shop_stores/checkoutStore/ORD-stringStore';
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';
import { OnApproveData } from '@paypal/paypal-js';
import { OrderAuthorizeResponse, OrdersCapture } from '@paypal/paypal-server-sdk';
import { usePost_PaymentProcessors } from './usePost-PaymentProcessors';
import { useServerActionWithState } from '../../useServerActionWithState';
import { FetcherError } from '@/lib/utils/SWRfetcherAdvanced';
import errorToast from '@/lib/error-toast';
import { useOrderProcessingStore } from '@/stores/shop_stores/checkoutStore/orderProcessingStore';
import { useShallow } from 'zustand/react/shallow';
import { buildServerPostProcessingFunc } from './paypalProcessingHelpers';
import { usePayPalIntentStore } from '@/stores/shop_stores/checkoutStore/paypalIntentStore';

// 🧩 Main Hook
export const usePayPalTXApproveCallback = () => {
  const cart = useCartStore((s) => s.variants);
  const { userMainProfile } = useUserMainProfileStore();
  const userId = userMainProfile?.id;
  const ORD_string = useOrderStringStore((s) => s.orderString);
  const orderToken = usePayPalIntentStore((s) => s.orderToken);
  const serverOrderDetails = useContext(ServerOrderDetailsContext);

  const {
    initializeProcessing,
    setStepStatus,
    setReceiptDetails,
    setOrderCustomId,
    setFlowStatus,
    resetProcessingState,
  } = useOrderProcessingStore(
    useShallow((state) => ({
      initializeProcessing: state.initializeProcessing,
      setStepStatus: state.setStepStatus,
      setReceiptDetails: state.setReceiptDetails,
      setOrderCustomId: state.setOrderCustomId,
      setFlowStatus: state.setFlowStatus,
      resetProcessingState: state.resetProcessingState,
    })),
  );

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

  const startProcessingUI = useCallback(
    (orderId: string) => {
      const checkoutSnapshot = useShopCheckoutStore.getState();
      resetProcessingState();
      initializeProcessing({
        orderId,
        orderString: ORD_string,
        customerName: `${checkoutSnapshot.first_name} ${checkoutSnapshot.last_name}`,
        customerEmail: checkoutSnapshot.email ?? 'john@example.com',
      });
    },
    [ORD_string, initializeProcessing, resetProcessingState],
  );

  const serverPostProcessingFunc = useMemo(
    () =>
      buildServerPostProcessingFunc({
        ORD_string,
        cart,
        country_iso2,
        userId,
        setStepStatus,
        setReceiptDetails,
        setOrderCustomId,
        setFlowStatus,
        uploadReceipt,
        savePaymentDataToBackend,
        pushOrderToMerchizeClient,
      }),
    [
      ORD_string,
      cart,
      country_iso2,
      pushOrderToMerchizeClient,
      savePaymentDataToBackend,
      setFlowStatus,
      setOrderCustomId,
      setReceiptDetails,
      setStepStatus,
      uploadReceipt,
      userId,
    ],
  );
  void serverPostProcessingFunc;

  const finalizeAfterCapture = useCallback(
    async (authData: OrderAuthorizeResponse, capturedOrder: OrdersCapture) => {
      if (!capturedOrder.id) return;
      try {
        startProcessingUI(capturedOrder.id);
        // await serverPostProcessingFunc({ authData, capturedOrder });
        // setModalVisible(false);
        // push(`/shop/checkout/confirmation/${capturedOrder.id}`);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : err instanceof FetcherError
              ? `info: ${err.info}, cause: ${err.cause}`
              : String(err);
        console.error('PayPal post-capture error:', err);
        errorToast({ message });
      }
    },
    [startProcessingUI],
  );

  // 💳 Main PayPal Approve Callback
  const mainPayPalApproveCallback = useCallback(
    async (data: OnApproveData) => {
      const readRouteErrorMessage = async (res: Response, fallback: string) => {
        try {
          const payload = (await res.json()) as {
            error?: { message?: string; code?: string; stage?: string; requestId?: string };
          };

          if (!payload?.error) return fallback;

          const { code, stage, requestId, message } = payload.error;
          return `[${stage ?? 'unknown_stage'}] ${code ?? 'UNKNOWN_ERROR'} (${requestId ?? 'no_request_id'}): ${message ?? fallback}`;
        } catch {
          return fallback;
        }
      };

      try {
        if (!orderToken) throw new Error('Missing PayPal order token');

        // 1️⃣ Authorize PayPal Order

        const authRes = await fetch('/next-api/paypal/orders/authorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderToken, orderID: data.orderID }),
        });
        if (!authRes.ok) {
          throw new Error(
            await readRouteErrorMessage(authRes, `Authorization failed: ${authRes.statusText}`),
          );
        }

        const authData = (await authRes.json()) as OrderAuthorizeResponse;
        const authorizationId = authData?.purchaseUnits?.[0]?.payments?.authorizations?.[0]?.id;
        if (!authorizationId) throw new Error('Missing authorization ID');

        // 2️⃣ Capture Payment

        const capRes = await fetch('/next-api/paypal/orders/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderToken, authorizationId }),
        });
        if (!capRes.ok) throw new Error(`Capture failed: ${capRes.statusText}`);

        const capturedOrder = (await capRes.json()) as OrdersCapture;
        if (capturedOrder?.status !== 'COMPLETED')
          throw new Error(`Payment not completed: ${capturedOrder?.status}`);
        if (!capturedOrder?.id) throw new Error('Missing PayPal order ID');

        // Run post-processing without blocking PayPal window
        void finalizeAfterCapture(authData, capturedOrder);
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
    [finalizeAfterCapture, orderToken],
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

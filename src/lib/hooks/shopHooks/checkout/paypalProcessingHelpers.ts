import successToast from '@/lib/success-toast';
import errorToast from '@/lib/error-toast';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { encrypt, CartVariant } from '@/stores/shop_stores/cartStore';
import { ProcessingStepKey } from '@/stores/shop_stores/checkoutStore/orderProcessingStore';
import { OrdersCapture } from '@paypal/paypal-server-sdk';
import { OrderResponseBody } from '@paypal/paypal-js';

type ServerPostProcessingDeps = {
  ORD_string: string;
  cart: CartVariant[];
  country_iso2?: string | null;
  userId?: string | null;
  setStepStatus: (
    key: ProcessingStepKey,
    status: 'pending' | 'success' | 'error',
    error?: string,
  ) => void;
  setReceiptDetails: (payload: { pdfReceiptLink?: string; receiptFileName?: string }) => void;
  setOrderCustomId: (orderCustomId?: string) => void;
  setFlowStatus: (status: 'idle' | 'processing' | 'completed' | 'error') => void;
  uploadReceipt: (payload: string) => Promise<
    | {
        ok: true;
        pdfReceiptLink: string;
        receiptFileName: string;
      }
    | {
        ok: false;
        error?: { message?: string };
      }
    | null
  >;
  savePaymentDataToBackend: (payload: string) => Promise<
    | {
        ok: true;
        data?: { custom_id?: string };
      }
    | {
        ok: false;
        error?: { message?: string };
      }
    | null
  >;
  pushOrderToMerchizeClient: (payload: string) => Promise<
    | {
        ok: true;
        data?: unknown;
      }
    | {
        ok: false;
        error?: { message?: string };
      }
    | null
  >;
};

const normalizeErrorMessage = (err: unknown, fallback: string) => {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: string }).message);
  }
  return fallback;
};

export const buildServerPostProcessingFunc = ({
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
}: ServerPostProcessingDeps) => {
  const stepError = (key: ProcessingStepKey, message: string) => {
    setStepStatus(key, 'error', message);
    setFlowStatus('error');
  };

  const handleStepFailure = (
    key: ProcessingStepKey,
    header: string,
    err: unknown,
    fallback: string,
  ) => {
    const message = normalizeErrorMessage(err, fallback);
    stepError(key, message);
    errorToast({ header, message });
    return message;
  };

  return async ({
    authData,
    capturedOrder,
  }: {
    authData: OrderResponseBody;
    capturedOrder: OrdersCapture;
  }) => {
    const checkoutSnapshot = useShopCheckoutStore.getState();
    const customerName = `${checkoutSnapshot.first_name} ${checkoutSnapshot.last_name}`;
    const customerEmail = checkoutSnapshot.email ?? 'john@example.com';
    const latestDeliveryAddress = checkoutSnapshot.delivery_address;

    const receiptPayload = encrypt(
      JSON.stringify({
        authData,
        customer: { name: customerName, email: customerEmail },
        ORD_string,
      }),
    );

    let receiptResp: { pdfReceiptLink: string; receiptFileName: string } | null = null;
    try {
      setStepStatus('receiptUpload', 'pending');
      const resp = await uploadReceipt(receiptPayload);
      if (!resp?.ok) {
        throw new Error(resp?.error?.message ?? 'Error occurred during receipt upload');
      }
      receiptResp = {
        pdfReceiptLink: resp.pdfReceiptLink,
        receiptFileName: resp.receiptFileName,
      };
      setReceiptDetails({
        pdfReceiptLink: resp.pdfReceiptLink,
        receiptFileName: resp.receiptFileName,
      });
      setStepStatus('receiptUpload', 'success');

      successToast({
        header: 'Payment Successful!',
        message: `Transaction complete: ${capturedOrder.id}`,
      });
    } catch (err) {
      const message = handleStepFailure(
        'receiptUpload',
        'Payment details upload failed',
        err,
        'Error occurred during receipt upload',
      );
      throw err instanceof Error ? err : new Error(message);
    }

    if (!receiptResp) {
      throw new Error('Receipt payload missing after upload');
    }
    const { pdfReceiptLink, receiptFileName } = receiptResp;

    const paymentSavePayload = encrypt(
      JSON.stringify({
        authData,
        finalCapturedOrder: capturedOrder,
        capturedOrderPaypalID: capturedOrder.id,
        customer: { name: customerName, email: customerEmail },
        delivery_address: latestDeliveryAddress,
        userId,
        ORD_string,
        pdfReceiptLink,
        receiptFileName,
      }),
    );

    let order_custom_id: string | undefined;
    try {
      setStepStatus('paymentSave', 'pending');
      const paymentResp = await savePaymentDataToBackend(paymentSavePayload);

      if (!paymentResp?.ok) {
        throw new Error(paymentResp?.error?.message ?? 'Could not save payment record');
      }

      order_custom_id = paymentResp.data?.custom_id;
      setOrderCustomId(order_custom_id);
      setStepStatus('paymentSave', 'success');
    } catch (err) {
      const message = handleStepFailure(
        'paymentSave',
        'Payment Save Failed',
        err,
        'Could not save payment record',
      );
      throw err instanceof Error ? err : new Error(message);
    }

    const orderVariants = cart.map(({ quantity, variantId }) => ({ quantity, variantId }));
    const orderRecipientInfo = {
      delivery_address: latestDeliveryAddress,
      customer: { name: customerName, email: customerEmail },
    };
    const merchizePayload = encrypt(
      JSON.stringify({
        orderVariants,
        orderRecipientInfo,
        country_iso2,
        order_custom_id: order_custom_id ?? capturedOrder.id,
      }),
    );

    try {
      setStepStatus('orderPush', 'pending');
      const pushRes = await pushOrderToMerchizeClient(merchizePayload);

      if (!pushRes?.ok) {
        throw new Error(pushRes?.error?.message ?? 'Could not push order to fulfillment');
      }

      setStepStatus('orderPush', 'success');
      setFlowStatus('completed');
    } catch (err) {
      const message = handleStepFailure(
        'orderPush',
        'Order push failed',
        err,
        'Could not push order to fulfillment',
      );
      throw err instanceof Error ? err : new Error(message);
    }
  };
};

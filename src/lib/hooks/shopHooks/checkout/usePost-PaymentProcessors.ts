import {
  MerchizeBackendOrderProps,
  sendMerchizeOrderDetailsToBackend,
} from '@/actions/shop/checkout/createMerchizeOrder/sendMerchizeOrderDetailsToBackend';
import { CreateOrderActionInterface } from '@/actions/shop/paypal/createOrderAction';
import {
  PaymentSavingActionProps,
  savePaymentDataToBackend,
} from '@/actions/shop/paypal/processAndUploadCompletedTx/savePaymentDataToBackend';
import {
  PaymentReceiptProps,
  savePaymentReceiptToCloud,
} from '@/actions/shop/paypal/processAndUploadCompletedTx/savePaymentReceiptToCloud';
import { CartVariant, decrypt } from '@/stores/shop_stores/cartStore';
import { OrderResponseBody } from '@paypal/paypal-js';
import { OrdersCapture } from '@paypal/paypal-server-sdk';
import { useCallback } from 'react';

export interface CompletedTxInterface {
  authData: OrderResponseBody;
  capturedOrder: OrdersCapture;
  cart: CartVariant[];
  userId?: string | null;
  customer: CreateOrderActionInterface['customer'];
  delivery_address: CreateOrderActionInterface['delivery_address'];
  ORD_string: string;
  country_iso2: string;
}

// Define explicit return types
export type ReceiptUploadSuccessResponse = {
  success: true;
  pdfReceiptLink: string;
  receiptFileName: string;
};

export type ErrorResponse = {
  success: false;
  message: string;
  errorId?: string;
};

export const usePost_PaymentProcessors = () => {
  /**
   * Client-side func to upload receipt to R2
   * @param 'authData', 'customer', 'ORD_string' -they (need to be encrypted)
   */
  const uploadPaymentReceipt = useCallback(async (encProps: string) => {
    try {
      const paymentProps: PaymentReceiptProps = JSON.parse(decrypt(encProps));

      const requiredKeys = ['authData', 'customer', 'ORD_string'] as (keyof PaymentReceiptProps)[];

      checkObjectKeys(paymentProps, requiredKeys);

      const receiptUploadRes = await savePaymentReceiptToCloud(encProps);
      if (receiptUploadRes.success === false) {
        const { message } = receiptUploadRes as ErrorResponse;
        return { ok: false as const, error: { message } };
      }
      const { pdfReceiptLink, receiptFileName } = receiptUploadRes as ReceiptUploadSuccessResponse;
      return { ok: true as const, pdfReceiptLink, receiptFileName };
    } catch (err: unknown) {
      return {
        ok: false as const,
        error: {
          message:
            err && typeof err === 'object' && 'message' in err
              ? (err.message as string)
              : 'Unknown error',
        },
      };
    }
  }, []);

  /**
   * Client-side payment details saver
   *
   *  please encrypt authData, finalCapturedOrder, 'capturedOrderPaypalID', customer, delivery_address, userId, ORD_string, pdfReceiptLink, receiptFileName,
   */
  const savePaymentTXToBackend = useCallback(async (encProps: string) => {
    try {
      const paymentSavingActionProps: PaymentSavingActionProps = JSON.parse(decrypt(encProps));
      const requiredKeys = [
        'authData',
        'finalCapturedOrder',
        'capturedOrderPaypalID',
        'customer',
        'delivery_address',
        'userId',
        'ORD_string',
        'pdfReceiptLink',
        'receiptFileName',
      ] as (keyof PaymentSavingActionProps)[];

      checkObjectKeys(paymentSavingActionProps, requiredKeys);

      const paymentSaveRes = await savePaymentDataToBackend(encProps);
      if (!paymentSaveRes.ok) {
        return { ok: false as const, error: paymentSaveRes.error };
      }

      return { ok: true as const, data: paymentSaveRes.data };
    } catch (err: unknown) {
      return {
        ok: false as const,
        error: {
          message:
            err && typeof err === 'object' && 'message' in err
              ? (err.message as string)
              : 'Unknown error',
        },
      };
    }
  }, []);

  /**
   * Please encrypt
   *
   * orderVariants, orderRecipientInfo: {'delivery_address', 'customer'} , ORD_string, country_iso2
   */
  const pushOrderToMerchize = useCallback(async (encProps: string) => {
    try {
      const merchizeOrderPushProps: MerchizeBackendOrderProps = JSON.parse(decrypt(encProps));
      const reqKeys = [
        'orderVariants',
        'orderRecipientInfo',
        'ORD_string',
        'country_iso2',
      ] as (keyof MerchizeBackendOrderProps)[];

      checkObjectKeys(merchizeOrderPushProps, reqKeys);

      const orderPushRes = await sendMerchizeOrderDetailsToBackend(encProps);

      if (!orderPushRes.ok) {
        return { ok: false as const, error: orderPushRes.error };
      }

      return { ok: true as const, data: orderPushRes.data.data };
    } catch (err: unknown) {
      return {
        ok: false as const,
        error: {
          message:
            err && typeof err === 'object' && 'message' in err
              ? (err.message as string)
              : 'Unknown error',
        },
      };
    }
  }, []);

  return { uploadPaymentReceipt, savePaymentTXToBackend, pushOrderToMerchize };
};

export function checkObjectKeys<T extends object>(obj: T, requiredKeys: Array<keyof T>): void {
  const objectKeys = Object.keys(obj) as Array<keyof T>;
  const missingKeys = requiredKeys.filter((key) => !objectKeys.includes(key));

  if (missingKeys.length > 0) {
    throw new Error(`"Missing keys:", ${missingKeys.join(', ')}`);
  }
}

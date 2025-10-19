// actions/generateInvoicePDF.ts
'use server';

import { OrderResponseBody } from '@paypal/paypal-js';
import { OrdersCapture } from '@paypal/paypal-server-sdk';
import { CartVariant, decrypt } from '@/stores/shop_stores/cartStore';
import { CreateOrderActionInterface } from '../createOrderAction';
import { savePaymentReceiptToCloud } from './savePaymentReceiptToCloud';
import { sendMerchizeOrderDetailsToBackend } from '../../checkout/createMerchizeOrder/sendMerchizeOrderDetailsToBackend';
import { savePaymentDataToBackend } from './savePaymentDataToBackend';

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
export type SuccessResponse = {
  success: true;
  pdfReceiptLink: string;
  receiptFileName: string;
};

export type ErrorResponse = {
  success: false;
  message: string;
  errorId: string;
};

export const processCompletedTxAction = async (encData: string) => {
  try {
    // Decrypt and parse data
    const decryptedData: CompletedTxInterface = JSON.parse(decrypt(encData));
    const { authData, customer, ORD_string, cart, country_iso2, delivery_address, capturedOrder } =
      decryptedData;
    const receiptUploadRes = await savePaymentReceiptToCloud({ authData, customer, ORD_string });

    const orderVariants = cart.map((v) => v);

    if (!receiptUploadRes.success) {
      throw new Error((receiptUploadRes as ErrorResponse).message);
    }

    if (!customer || !customer.name || !customer.email) {
      throw new Error('Customer name and email are required');
    }

    // After the success check above, receiptUploadRes is narrowed to the success shape
    const { pdfReceiptLink, receiptFileName } = receiptUploadRes as SuccessResponse;

    const asyncBackendTasks = [
      savePaymentDataToBackend({
        pdfReceiptLink,
        receiptFileName,
        authData,
        customer,
        delivery_address,
        country_iso2,
        ORD_string,
        capturedOrder,
      }),
      sendMerchizeOrderDetailsToBackend({
        country_iso2,
        ORD_string,
        orderRecipientInfo: { ...customer, ...delivery_address },
        orderVariants,
      }),
    ];

    const settled = await Promise.allSettled(asyncBackendTasks);

    const resultA = settled[0];
    const resultB = settled[1];

    console.log(resultA, resultB);
    return { resultA, resultB };
  } catch (error: unknown) {
    console.log(error);
  }
};

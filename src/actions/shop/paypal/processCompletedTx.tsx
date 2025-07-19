// actions/generateInvoicePDF.ts
'use server';

import { OrderResponseBody } from '@paypal/paypal-js';
import { OrdersCapture } from '@paypal/paypal-server-sdk';
import { CartVariant, decrypt } from '@/stores/shop_stores/cartStore';
import fs from 'node:fs/promises';
import path from 'node:path';
import { uploadPaymentReceiptToR2 } from '../checkout/transactions/uploadPaymentReceipt';
import { createPaypalShopInvoicePDF } from './createShopInvoicePDF';
import { CreateOrderActionInterface } from './createOrderAction';
import { postOrderTOBackend, BackendResponse } from '../checkout/postOrderToBackend'; // Import BackendResponse

export interface CompletedTxInterface {
  authData: OrderResponseBody;
  capturedOrder: OrdersCapture;
  cart: CartVariant[];
  userId?: string;
  customer: CreateOrderActionInterface['customer'];
  delivery_address: CreateOrderActionInterface['delivery_address'];
}

// Define explicit return types
type SuccessResponse = {
  success: true;
  pdfLink: string;
  authData: OrderResponseBody;
  capturedOrder: OrdersCapture;
} & BackendResponse;

type ErrorResponse = {
  success: false;
  message: string;
  errorId: string;
};

export const processCompletedTxAction = async (
  encData: string,
): Promise<SuccessResponse | ErrorResponse> => {
  try {
    // Decrypt and parse data
    const decryptedData: CompletedTxInterface = JSON.parse(decrypt(encData));
    const { authData, capturedOrder } = decryptedData;

    const pdfBuffer = await createPaypalShopInvoicePDF(authData);

    // Upload to r2
    const { accessLink } = await uploadPaymentReceiptToR2({
      fileBody: pdfBuffer,
      filename: `invoice-${authData.id}-${authData.payer?.email_address}.pdf`,
    });

    const backendResp = await postOrderTOBackend(decryptedData);

    const clientSideResp: SuccessResponse = {
      success: true,
      pdfLink: accessLink,
      authData,
      capturedOrder,
      ...backendResp,
    };
    return clientSideResp;

    // Catch errors
  } catch (error: unknown) {
    // Save error details
    const errorDir = path.join(process.cwd(), 'transaction-errors');
    await fs.mkdir(errorDir, { recursive: true });

    let errorMessage = 'Unknown error';
    let errorStack = undefined;
    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack; // Preserving stack trace
    }
    console.log('TX Upload Err: ', error);

    const errorPath = path.join(errorDir, `error-${Date.now()}.json`);
    await fs.writeFile(
      errorPath,
      JSON.stringify(
        {
          error: errorMessage,
          stack: errorStack, // Preserved stack in error file
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
    );

    // Try to save customer details offline for manual re-upload
    // To-Do...

    // //FOR DEV USE
    // throw new Error(errorMessage);

    //Production use, till we figure out a way to capture unprocessed orders
    return {
      success: false,
      message: errorMessage,
      errorId: path.basename(errorPath),
    };
  }
};

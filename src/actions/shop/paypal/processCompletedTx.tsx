// actions/generateInvoicePDF.ts
'use server';

import { OrderResponseBody } from '@paypal/paypal-js';
import { OrdersCapture } from '@paypal/paypal-server-sdk';
import { decrypt } from '@/stores/shop_stores/cartStore';
import fs from 'node:fs/promises';
import path from 'node:path';
import { uploadPaymentReceiptToR2 } from '../checkout/transactions/uploadPaymentReceipt';
import { createPaypalShopInvoicePDF } from './createShopInvoicePDF';

export interface CompletedTxInterface {
  authData: OrderResponseBody;
  capturedOrder: OrdersCapture;
}

export const processCompletedTxAction = async (encData: string) => {
  try {
    // Decrypt and parse data
    const decryptedData: CompletedTxInterface = JSON.parse(decrypt(encData));
    const { authData } = decryptedData;

    const pdfBuffer = await createPaypalShopInvoicePDF(authData);

    // Upload to r2
    const { accessLink } = await uploadPaymentReceiptToR2({
      fileBody: pdfBuffer,
      filename: `invoice-${authData.id}-${authData.payer?.email_address}.pdf`,
    });

    // Catch errors
  } catch (error: unknown) {
    // Save error details
    const errorDir = path.join(process.cwd(), 'transaction-errors');
    await fs.mkdir(errorDir, { recursive: true });

    let errorMessage = 'Unknown error';
    let errorStack = undefined;
    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack;
    }
    console.log('TX Upload Err: ', error);

    const errorPath = path.join(errorDir, `error-${Date.now()}.json`);
    await fs.writeFile(
      errorPath,
      JSON.stringify(
        {
          error: errorMessage,
          stack: errorStack,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
    );

    return {
      success: false,
      message: 'Failed to generate PDF',
      errorId: path.basename(errorPath),
    };
  }
};

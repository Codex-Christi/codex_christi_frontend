'use server';

import fs from 'node:fs/promises';
import path from 'path';
import { uploadPaymentReceiptToR2 } from '../../checkout/transactions/uploadPaymentReceipt';
import { createPaypalShopInvoicePDF } from '../createShopInvoicePDF';
import { CompletedTxInterface } from '@/lib/hooks/shopHooks/checkout/usePost-PaymentProcessors';
import { decrypt } from '@/stores/shop_stores/cartStore';

export interface PaymentReceiptProps {
  authData: CompletedTxInterface['authData'];
  customer: CompletedTxInterface['customer'];
  ORD_string: CompletedTxInterface['ORD_string'];
}

export const savePaymentReceiptToCloud = async (encodedProps: string) => {
  try {
    // Decrypt and parse data
    const { authData, customer, ORD_string } = JSON.parse(
      decrypt(encodedProps),
    ) as PaymentReceiptProps;
    const { email: customerEmail, name: customerName } = customer || {};

    const pdfBuffer = await createPaypalShopInvoicePDF(authData);

    // Upload to r2
    const { accessLink } = await uploadPaymentReceiptToR2({
      fileBody: pdfBuffer,
      filename: `invoice-${authData.id}-${customerName}-${customerEmail}.pdf`,
    });

    // Post order data to backend
    if (!ORD_string || ORD_string === '') {
      throw new Error('Missing order identifier for backend processing.');
    }

    const clientSideResp = {
      success: true,
      pdfReceiptLink: accessLink,
      receiptFileName: `invoice-${authData.id}-${customerName}-${customerEmail}`,
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

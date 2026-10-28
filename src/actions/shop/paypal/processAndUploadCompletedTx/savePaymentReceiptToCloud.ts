'use server';

import { uploadPaymentReceiptToR2 } from '../../checkout/transactions/uploadPaymentReceipt';
import { createPaypalShopInvoicePDF } from '../createShopInvoicePDF';
import type { CompletedTxInterface } from '@/types/shop/paypalCompletedTx';
import { decryptForPostProcessingServerAction } from '@/lib/utils/shop/checkout/serverPostProcessingCrypto';
import type { CanonicalOrderSnapshot } from '@/lib/paypal/orderSnapshot/types';
import { randomUUID } from 'node:crypto';
import { opaqueReceiptFile } from '@/lib/shop/orderHistory/receiptReference';

export interface PaymentReceiptProps {
  orderToken?: string;
  receiptFileName?: string | null;
  authData: CompletedTxInterface['authData'];
  cart?: CompletedTxInterface['cart'];
  canonicalOrderSnapshot?: CanonicalOrderSnapshot | null;
  customer: CompletedTxInterface['customer'];
  ORD_string: CompletedTxInterface['ORD_string'];
  shippingAddressOverride?: {
    shipping_address_line_1: string;
    shipping_address_line_2?: string;
    shipping_city: string;
    shipping_state: string;
    zip_code: string;
    shipping_country: string;
  } | null;
}

export const savePaymentReceiptToCloud = async (
  encodedProps: string,
): Promise<
  | { success: true; pdfReceiptLink: string; receiptFileName: string }
  | { success: false; message: string }
> => {
  try {
    const {
      authData,
      cart,
      canonicalOrderSnapshot,
      customer,
      ORD_string,
      shippingAddressOverride,
      orderToken: suppliedToken,
      receiptFileName: previousFile,
    } = JSON.parse(
      decryptForPostProcessingServerAction(encodedProps, 'receipt'),
    ) as PaymentReceiptProps;
    const auth = authData as unknown as {
      purchaseUnits?: Array<{ customId?: string }>;
      purchase_units?: Array<{ custom_id?: string }>;
    };
    const orderToken =
      suppliedToken ?? auth.purchaseUnits?.[0]?.customId ?? auth.purchase_units?.[0]?.custom_id;
    if (!orderToken || !/^[A-Za-z0-9_-]{1,128}$/u.test(orderToken) || !ORD_string)
      throw new Error('Missing order receipt reference.');
    const receiptFileName = opaqueReceiptFile(previousFile)
      ? previousFile
      : `receipt-${randomUUID()}`;

    const pdfBuffer = await createPaypalShopInvoicePDF(
      authData,
      cart,
      shippingAddressOverride,
      canonicalOrderSnapshot,
      customer,
    );

    const { accessLink } = await uploadPaymentReceiptToR2({
      fileBody: pdfBuffer,
      filename: `${receiptFileName}.pdf`,
      orderToken,
    });

    return {
      success: true,
      pdfReceiptLink: accessLink,
      receiptFileName,
    };
  } catch (error: unknown) {
    // The processing runner records this failure in the ledger for support/retry.
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Receipt could not be saved.',
    };
  }
};

import { cache } from 'react';
import { CompletedTxInterface } from '../paypal/processCompletedTx';

// Derive types from CompletedTxInterface to keep DRY (DeepSeek's improvement)
type ResponseData = {
  message: string;
  timestamp: string;
  capturedOrderPaypalID: CompletedTxInterface['capturedOrder']['id'];
  custom_id: string;
  amountReceived: string | null;
  payer: {
    payerEmail: string | undefined;
    payerName: string;
  } | null;
  orderReceipient: {
    name: string | undefined;
    recepientEmail: string | null;
  };
  delivery_address: CompletedTxInterface['delivery_address'];
  userId: CompletedTxInterface['userId'] | null;
};

export interface BackendResponse {
  status: number;
  data: ResponseData;
}

export const postOrderTOBackend = cache(
  async (paymentAndOrderData: CompletedTxInterface): Promise<BackendResponse> => {
    // Main Destructuring (original comment)
    const { authData, capturedOrder, cart, customer, delivery_address, userId } =
      paymentAndOrderData;

    // Sub-destructuring (original comment)
    const { id: capturedOrderPaypalID } = capturedOrder;
    const { purchase_units, payer } = authData;
    const { email_address: payerEmail, name: payerName } = payer || {};

    // Safe array access with defaults (DeepSeek's improvement)
    const [firstPurchaseUnit = {}] = purchase_units || [];
    const { amount, custom_id, shipping } = firstPurchaseUnit;
    const { name: recepientName } = shipping || {};
    const recepientEmail = customer?.email;
    const { currency_code, value } = amount || {};

    // Simulate for now (original comment)
    return new Promise<BackendResponse>((resolve, reject) => {
      setTimeout(() => {
        // Improved missing params validation (DeepSeek's solution to identify missing params)
        if (!authData || !capturedOrder || !cart || !customer || !delivery_address) {
          const missingParams = (
            ['authData', 'capturedOrder', 'cart', 'customer', 'delivery_address'] as const
          )
            .filter((param) => !paymentAndOrderData[param])
            .join(', ');

          reject(new Error(`Missing required parameters: ${missingParams}`));
          return;
        }

        // Simulate successful backend processing (original comment)
        const responseData = {
          message: 'Data successfully processed!',
          timestamp: new Date().toISOString(),
          capturedOrderPaypalID,
          custom_id: custom_id!,
          amountReceived: amount ? `${value} ${currency_code}` : null,
          payer: payer
            ? {
                payerEmail: payerEmail!,
                payerName: `${payerName?.given_name} ${payerName?.surname}`,
              }
            : null,
          orderReceipient: {
            name: recepientName?.full_name,
            recepientEmail: recepientEmail!,
          },
          delivery_address,
          userId: userId ?? null,
        };

        resolve({
          status: 200,
          data: responseData,
        });
      }, 500);
    });
  },
);

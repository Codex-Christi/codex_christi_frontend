import { cache } from 'react';
import { CompletedTxInterface } from '../paypal/processCompletedTx';
import { OrderResponseBody } from '@paypal/paypal-js';

// Derive types from CompletedTxInterface to keep DRY (DeepSeek's improvement)
interface ResponseData extends Omit<OrderResponseBody, 'payer'> {
  message: string;
  timestamp: string;
  capturedOrderPaypalID: CompletedTxInterface['capturedOrder']['id'];
  custom_id: string;
  amountReceived: string | null;

  orderReceipient: {
    name: string | undefined;
    recepientEmail: string | null;
  };
  paypal_profile_delivery_address: CompletedTxInterface['delivery_address'] | null | undefined;
  userId: CompletedTxInterface['userId'] | null;
  paypalAuthorizationData: CompletedTxInterface['authData'];
}

export interface BackendResponse {
  status: number;
  paymentJSONData: ResponseData;
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
          paymentAuthID: authData.id,
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
          paypal_profile_delivery_address: delivery_address,
          userId: userId ?? null,
          paypalAuthorizationData: authData,
        };

        resolve({
          status: 200,
          paymentJSONData: responseData,
        });
      }, 500);
    });
  },
);

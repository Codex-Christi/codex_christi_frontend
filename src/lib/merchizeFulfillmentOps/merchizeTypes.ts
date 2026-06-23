export type JsonRecord = Record<string, unknown>;

export type MerchizeOrderLookupResponse = {
  success?: boolean;
  message?: string;
  data?: JsonRecord | null;
};

export type MerchizeInDepthOrderDetailResponse = {
  success?: boolean;
  message?: string;
  data?: JsonRecord | null;
};

export type MerchizeFulfillmentRegistrationInput = {
  orderToken: string;
  paypalOrderId: string | null;
  djangoOrderIntentUuid: string | null;
  djangoOrderIntentOrderId: string | null;
  djangoPaymentSaveCustomId: string;
  fulfillmentIdentifier?: string | null;
  merchizeExternalOrderNumber: string;
  merchizeOrderId: string | null;
  merchizeOrderCode: string | null;
  merchizeStatus: string | null;
  djangoProcessResponsePayload: unknown;
  customerEmail?: string | null;
  shippingSnapshot?: unknown;
  cartSnapshot?: unknown;
};

export type MerchizeFulfillmentSyncResult =
  | {
      ok: true;
      orderToken: string;
      merchizeExternalOrderNumber: string;
      merchizeOrderId: string;
      itemCount: number;
    }
  | {
      ok: false;
      orderToken: string;
      errorCode: string;
      errorMessage: string;
      pending?: boolean;
      retryable?: boolean;
    };

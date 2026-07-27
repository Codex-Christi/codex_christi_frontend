export type PaidOrderRetryMode = 'none' | 'resume_post_payment' | 'retry_merchize_fulfillment';

export type MerchizeFulfillmentRetryCheckpoint =
  | 'capture'
  | 'receipt'
  | 'django_payment_save'
  | 'django_fulfillment_handoff'
  | 'merchize_external_order';

export type MerchizeFulfillmentRetryEligibility =
  | {
      eligible: true;
      mode: 'retry_merchize_fulfillment';
    }
  | {
      eligible: false;
      code: string;
      message: string;
      missingCheckpoint: MerchizeFulfillmentRetryCheckpoint;
      mode: 'resume_post_payment';
    };

export function getMerchizeFulfillmentRetryEligibility(args: {
  captureComplete: boolean;
  hasAcceptedDjangoFulfillmentHandoff: boolean;
  hasDjangoPaymentSaveCustomId: boolean;
  hasMerchizeExternalOrderNumber: boolean;
  hasPersistedReceipt: boolean;
}): MerchizeFulfillmentRetryEligibility {
  if (!args.captureComplete) {
    return {
      eligible: false,
      code: 'MERCHIZE_RETRY_CAPTURE_CHECKPOINT_REQUIRED',
      message:
        'Merchize fulfillment retry is unavailable because completed PayPal capture evidence is missing.',
      missingCheckpoint: 'capture',
      mode: 'resume_post_payment',
    };
  }

  if (!args.hasPersistedReceipt) {
    return {
      eligible: false,
      code: 'MERCHIZE_RETRY_RECEIPT_CHECKPOINT_REQUIRED',
      message:
        'Merchize fulfillment retry is unavailable until receipt generation and upload complete.',
      missingCheckpoint: 'receipt',
      mode: 'resume_post_payment',
    };
  }

  if (!args.hasDjangoPaymentSaveCustomId) {
    return {
      eligible: false,
      code: 'MERCHIZE_RETRY_DJANGO_PAYMENT_SAVE_REQUIRED',
      message:
        'Merchize fulfillment retry is unavailable until Django payment save returns its custom ID.',
      missingCheckpoint: 'django_payment_save',
      mode: 'resume_post_payment',
    };
  }

  if (!args.hasAcceptedDjangoFulfillmentHandoff) {
    return {
      eligible: false,
      code: 'MERCHIZE_RETRY_DJANGO_HANDOFF_REQUIRED',
      message:
        'Merchize fulfillment retry is unavailable until Django accepts the fulfillment handoff.',
      missingCheckpoint: 'django_fulfillment_handoff',
      mode: 'resume_post_payment',
    };
  }

  if (!args.hasMerchizeExternalOrderNumber) {
    return {
      eligible: false,
      code: 'MERCHIZE_RETRY_EXTERNAL_ORDER_NUMBER_REQUIRED',
      message:
        'Merchize fulfillment retry is unavailable because the accepted Django handoff has no external order number.',
      missingCheckpoint: 'merchize_external_order',
      mode: 'resume_post_payment',
    };
  }

  return {
    eligible: true,
    mode: 'retry_merchize_fulfillment',
  };
}

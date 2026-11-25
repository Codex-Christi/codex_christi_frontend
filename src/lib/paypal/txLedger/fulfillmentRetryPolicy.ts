import { isMerchizeLookupPendingProviderProcessingError } from '@/lib/merchizeFulfillmentOps/lookupPending';
import { MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS as GATE } from '@/lib/merchizeFulfillmentOps/status';
import { CUSTOMER_ADDRESS_CORRECTION_REQUESTED } from '@/lib/shop/checkout/customerAddressCorrection';
import { PAYPAL_LEDGER_STATUS } from './status';

export type PaidOrderRetryMode = 'none' | 'resume_post_payment' | 'retry_merchize_fulfillment';

export function getMerchizeReleaseReview(
  evidence?: {
    productionGateStatus: string | null;
    providerPushProgress: string | null;
    pushAcknowledgedAt: string | null;
    pushVerifiedAt: string | null;
  } | null,
) {
  const gate = evidence?.productionGateStatus;
  const acknowledgementRecorded = Boolean(evidence?.pushAcknowledgedAt);
  const verified = Boolean(evidence?.pushVerifiedAt) || gate === GATE.PUSH_VERIFIED;
  const verificationPending =
    !verified &&
    gate !== GATE.PUSH_FAILED &&
    (acknowledgementRecorded ||
      gate === GATE.PUSH_PENDING ||
      gate === GATE.PUSH_ACKNOWLEDGED ||
      gate === GATE.PUSH_VERIFICATION_PENDING ||
      ['validating', 'scheduled', 'paused'].includes(evidence?.providerPushProgress ?? ''));

  return { acknowledgementRecorded, verified, verificationPending };
}

export function getMerchizeReadyRefreshFeedback(releaseVerified: boolean, snapshotsSynced: boolean) {
  if (!releaseVerified) {
    return {
      tone: 'warning',
      heading: 'Release not confirmed',
      message:
        'Readiness checks passed. This refresh did not send a push. Refresh Merchize state again before retrying.',
    } as const;
  }
  if (!snapshotsSynced) {
    return {
      tone: 'warning',
      heading: 'Release confirmed',
      message: 'Merchize confirmed release, but some details could not be refreshed.',
    } as const;
  }
  return {
    tone: 'success',
    message: 'Merchize confirmed that the order was released for fulfillment.',
  } as const;
}

export function getPushVerificationPendingMessage(
  outcome?: 'acknowledged' | 'unconfirmed' | 'not_sent',
) {
  const nextStep = 'Refresh Merchize state before trying to release again.';
  if (outcome === 'acknowledged') {
    return `Merchize acknowledged the push request, but production release is not yet confirmed. ${nextStep}`;
  }
  if (outcome === 'unconfirmed') {
    return 'Merchize did not confirm receipt of the push request. Refresh Merchize state without sending another push.';
  }
  if (outcome === 'not_sent') {
    return `This action did not send a new push request. Merchize has not confirmed production release. ${nextStep}`;
  }
  return `Merchize has not confirmed production release. ${nextStep}`;
}

export function getPendingFulfillmentRetryMessage({
  status,
  lastErrorCode,
  hasAcceptedDjangoHandoff,
}: {
  status: string;
  lastErrorCode: string | null;
  hasAcceptedDjangoHandoff: boolean;
}) {
  if (status !== PAYPAL_LEDGER_STATUS.PAYMENT_SAVED || !hasAcceptedDjangoHandoff) return null;
  if (lastErrorCode === 'MERCHIZE_ADDRESS_VALIDATION_PENDING') {
    return 'Payment is saved and Merchize received the order. Its delivery address check is still pending. Refresh Merchize state to check again.';
  }
  if (lastErrorCode === CUSTOMER_ADDRESS_CORRECTION_REQUESTED) {
    return 'The buyer submitted a corrected address. Merchize has not verified it yet.';
  }
  if (lastErrorCode === 'MERCHIZE_PUSH_VERIFICATION_PENDING') {
    return getPushVerificationPendingMessage();
  }
  if (isMerchizeLookupPendingProviderProcessingError(lastErrorCode)) {
    return 'Payment is saved and Django accepted the order. Merchize is still making the order available. Refresh Merchize state to check again.';
  }
  return null;
}

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

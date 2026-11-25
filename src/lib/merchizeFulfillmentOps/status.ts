export const MERCHIZE_ORDER_ON_HOLD = 'MERCHIZE_ORDER_ON_HOLD';
export const MERCHIZE_FULFILLMENT_CANCELED = 'cancelled';
export const MERCHIZE_FULFILLMENT_CANCELED_CODE = 'MERCHIZE_FULFILLMENT_CANCELED';
export const MERCHIZE_CANCELLATION_STATUSES = [
  MERCHIZE_FULFILLMENT_CANCELED,
  'canceled',
  'cancelled_fulfillment',
  'canceled_fulfillment',
] as const;

export function isMerchizeFulfillmentCanceled(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase();
  return MERCHIZE_CANCELLATION_STATUSES.some((value) => value === normalized);
}

export const MERCHIZE_FULFILLMENT_SYNC_STATUS = {
  REGISTERED: 'registered',
  PROCESS_ACCEPTED: 'process_accepted',
  LOOKUP_PENDING: 'lookup_pending',
  LOOKUP_FAILED: 'lookup_failed',
  LOOKUP_NOT_FOUND: 'lookup_not_found',
  LOOKUP_FOUND: 'lookup_found',
  DETAIL_PENDING: 'detail_pending',
  DETAIL_FAILED: 'detail_failed',
  DETAIL_SYNCED: 'detail_synced',
  READINESS_CHECKING: 'production_readiness_checking',
  READINESS_BLOCKED: 'production_readiness_blocked',
  READINESS_READY: 'production_readiness_ready',
  PUSH_PENDING: 'push_to_fulfillment_pending',
  PUSH_ACKNOWLEDGED: 'push_to_fulfillment_acknowledged',
  PUSH_VERIFICATION_PENDING: 'push_to_fulfillment_verification_pending',
  PUSH_VERIFIED: 'push_to_fulfillment_verified',
  PUSH_FAILED: 'push_to_fulfillment_failed',
  PUSH_DISABLED: 'push_to_fulfillment_disabled',
  MANUAL_REVIEW_REQUIRED: 'manual_review_required',
} as const;

export type MerchizeFulfillmentSyncStatus =
  (typeof MERCHIZE_FULFILLMENT_SYNC_STATUS)[keyof typeof MERCHIZE_FULFILLMENT_SYNC_STATUS];

export const MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS = {
  RUNNING: 'running',
  UNCONFIRMED: 'unconfirmed',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const;

export const MERCHIZE_PUSH_ACTION = 'push_to_fulfillment';
export const MERCHIZE_UNCONFIRMED_PUSH_ATTEMPT = {
  action: MERCHIZE_PUSH_ACTION,
  status: {
    in: [
      MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.RUNNING,
      MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS.UNCONFIRMED,
    ],
  },
};

export const MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS = {
  CHECKING: 'checking',
  READY: 'ready',
  BLOCKED: 'blocked',
  MANUAL_RELEASE_REQUIRED: 'manual_release_required',
  PUSH_PENDING: 'push_pending',
  PUSH_ACKNOWLEDGED: 'push_acknowledged',
  PUSH_VERIFICATION_PENDING: 'push_verification_pending',
  PUSH_VERIFIED: 'push_verified',
  PUSH_FAILED: 'push_failed',
  PUSH_DISABLED: 'push_disabled',
  HELD: 'held',
} as const;

export const MERCHIZE_ADDRESS_REVIEW_STATUS = {
  READY: 'ready',
  BUYER_CONFIRMED: 'buyer_confirmed',
  PENDING: 'pending',
  BLOCKED: 'blocked',
  UNKNOWN: 'unknown',
  PROVIDER_UPDATE_PENDING_VALIDATION: 'provider_update_pending_validation',
  PROVIDER_UPDATE_FAILED: 'provider_update_failed',
} as const;

export const MERCHIZE_REVIEW_STATUS = {
  READY: 'ready',
  PENDING: 'pending',
  BLOCKED: 'blocked',
  UNKNOWN: 'unknown',
} as const;

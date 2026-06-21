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
  PUSH_PENDING: 'push_to_fulfillment_pending',
  PUSH_ACCEPTED: 'push_to_fulfillment_accepted',
  PUSH_FAILED: 'push_to_fulfillment_failed',
  PUSH_DISABLED: 'push_to_fulfillment_disabled',
  MANUAL_REVIEW_REQUIRED: 'manual_review_required',
} as const;

export type MerchizeFulfillmentSyncStatus =
  (typeof MERCHIZE_FULFILLMENT_SYNC_STATUS)[keyof typeof MERCHIZE_FULFILLMENT_SYNC_STATUS];

export const MERCHIZE_FULFILLMENT_SYNC_ATTEMPT_STATUS = {
  RUNNING: 'running',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const;

export const MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS = {
  PUSH_PENDING: 'push_pending',
  PUSH_ACCEPTED: 'push_accepted',
  PUSH_FAILED: 'push_failed',
  PUSH_DISABLED: 'push_disabled',
  HELD: 'held',
} as const;

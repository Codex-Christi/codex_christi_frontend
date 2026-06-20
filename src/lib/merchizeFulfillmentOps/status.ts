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

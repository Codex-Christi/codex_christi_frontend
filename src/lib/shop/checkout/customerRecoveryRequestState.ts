export type CustomerRecoveryRequestState =
  'available' | 'queued' | 'processing' | 'review_required' | 'completed' | 'unavailable';

export function isCustomerRecoveryPending(state: CustomerRecoveryRequestState | null | undefined) {
  return state === 'queued' || state === 'processing';
}

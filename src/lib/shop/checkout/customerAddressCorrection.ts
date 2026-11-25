export const CUSTOMER_ADDRESS_CORRECTION_REQUESTED = 'MERCHIZE_CUSTOMER_ADDRESS_CORRECTION_REQUESTED';
export const CUSTOMER_ADDRESS_CORRECTION_REVIEW = 'MERCHIZE_CUSTOMER_ADDRESS_REVIEW_REQUIRED';
export const CUSTOMER_ADDRESS_CORRECTION_ACTOR = 'verified_customer';
export const CUSTOMER_ADDRESS_CORRECTION_REASON = 'Buyer confirmed a corrected delivery address.';
export const CUSTOMER_ADDRESS_VALIDATION_GRACE_MS = 5 * 60_000;

export type CustomerAddressCorrectionState = 'required' | 'checking' | 'review';

export function customerAddressCorrectionState(row: {
  status: string;
  lastErrorCode: string | null;
  fulfillmentAddressOverriddenBy: string | null;
  fulfillmentAddressOverriddenAt: Date | null;
}): CustomerAddressCorrectionState | null {
  if (row.status === 'payment_saved' && (
    row.lastErrorCode === CUSTOMER_ADDRESS_CORRECTION_REQUESTED ||
    (row.fulfillmentAddressOverriddenBy === CUSTOMER_ADDRESS_CORRECTION_ACTOR &&
      row.lastErrorCode === 'MERCHIZE_ADDRESS_VALIDATION_PENDING')
  )) return 'checking';
  if (row.status !== 'fulfillment_attention_required') return null;
  if (row.lastErrorCode === CUSTOMER_ADDRESS_CORRECTION_REVIEW) return 'review';
  if (row.lastErrorCode !== 'MERCHIZE_ADDRESS_INVALID') return null;
  return row.fulfillmentAddressOverriddenAt ? 'review' : 'required';
}

export function classifyBuyerCorrectionFlag({
  actor, primaryCode, readback, blockers, providerAddressUpdatedAt, now = new Date(),
}: {
  actor: string | null;
  primaryCode: string;
  readback: string;
  blockers: Array<{ code: string; retryable: boolean }>;
  providerAddressUpdatedAt: Date | null;
  now?: Date;
}) {
  if (actor !== CUSTOMER_ADDRESS_CORRECTION_ACTOR || primaryCode !== 'MERCHIZE_ADDRESS_INVALID') return null;
  const elapsed = providerAddressUpdatedAt ? now.getTime() - providerAddressUpdatedAt.getTime() : null;
  const waiting = readback === 'matched' && elapsed !== null && elapsed >= 0 &&
    elapsed < CUSTOMER_ADDRESS_VALIDATION_GRACE_MS &&
    blockers.every(({ code, retryable }) => code === primaryCode || retryable);
  return waiting ? 'waiting' : 'review';
}

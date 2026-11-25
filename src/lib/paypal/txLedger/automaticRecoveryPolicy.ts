import { PAYPAL_LEDGER_STATUS } from './status';
import { getDjangoHandoffReview } from './djangoHandoff';
import { getCanonicalPaymentProjectionState } from './canonicalPaymentProjectionState';

export const AUTOMATIC_RECOVERY_STATUSES = [
  PAYPAL_LEDGER_STATUS.CAPTURED,
  PAYPAL_LEDGER_STATUS.RECEIPT_UPLOADED,
  PAYPAL_LEDGER_STATUS.PAYMENT_SAVED,
] as const;

const resumableStatuses = new Set<string>(AUTOMATIC_RECOVERY_STATUSES);

export function hasAutomaticRecoveryEvidence(
  row: Parameters<typeof getCanonicalPaymentProjectionState>[0] &
    Parameters<typeof getDjangoHandoffReview>[0],
  payment = getCanonicalPaymentProjectionState(row),
) {
  return (
    resumableStatuses.has(row.status) &&
    Boolean(row.authorizePayload) &&
    payment.captureCompletion.ok &&
    payment.paymentSafeForPostProcessing &&
    !getDjangoHandoffReview(row)
  );
}

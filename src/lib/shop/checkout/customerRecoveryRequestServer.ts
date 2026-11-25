import 'server-only';

import { assertShopOpsMutationAllowed } from '@/lib/prisma/shop/shopOpsDataTarget';
import { getCanonicalPaymentProjectionState } from '@/lib/paypal/txLedger/canonicalPaymentProjectionState';
import { hasAutomaticRecoveryEvidence } from '@/lib/paypal/txLedger/automaticRecoveryPolicy';
import { isAcceptedDjangoFulfillmentProcessResponse } from '@/lib/paypal/txLedger/fulfillmentProcessResponse';
import {
  getRecoveryScannerBatchSize,
  getRecoveryScannerMinAgeMinutes,
  isRecoveryScannerEnabled,
} from '@/lib/paypal/txLedger/processingPolicy';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import type { CustomerRecoveryRequestState } from './customerRecoveryRequestState';

export const CUSTOMER_RECOVERY_GRACE_MS = 45_000;

function recoveryScannerAvailable() {
  try {
    if (!isRecoveryScannerEnabled() || !process.env.PAYPAL_TX_LEDGER_RECOVERY_SCANNER_SECRET?.trim())
      return false;
    assertShopOpsMutationAllowed();
    getRecoveryScannerMinAgeMinutes();
    getRecoveryScannerBatchSize();
    return true;
  } catch {
    return false;
  }
}

export function getCustomerRecoveryRequestState(
  row: Parameters<typeof hasAutomaticRecoveryEvidence>[0] & {
    updatedAt: Date;
    customerRecoveryRequestedAt?: Date | null;
    processingCompletedAt?: Date | null;
    postProcessingLockExpiresAt?: Date | null;
  },
  {
    now = new Date(),
    payment = getCanonicalPaymentProjectionState(row),
    scannerAvailable = recoveryScannerAvailable,
  } = {},
): CustomerRecoveryRequestState | null {
  if (!payment.captureCompletion.ok || row.status === PAYPAL_LEDGER_STATUS.REFUNDED) return null;

  const requested = Boolean(row.customerRecoveryRequestedAt);
  if (row.processingCompletedAt || row.status === PAYPAL_LEDGER_STATUS.COMPLETED) {
    return requested ? (payment.paymentFailure ? 'review_required' : 'completed') : null;
  }
  if (!hasAutomaticRecoveryEvidence(row, payment)) return requested ? 'review_required' : null;
  if (isAcceptedDjangoFulfillmentProcessResponse(row.merchizeFulfillmentResponsePayload)) {
    return null;
  }
  if (row.postProcessingLockExpiresAt && row.postProcessingLockExpiresAt >= now)
    return requested ? 'processing' : null;
  if (!requested && now.getTime() - row.updatedAt.getTime() < CUSTOMER_RECOVERY_GRACE_MS)
    return null;
  if (!scannerAvailable()) return 'unavailable';
  return requested ? 'queued' : 'available';
}

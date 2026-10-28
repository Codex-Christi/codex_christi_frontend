import 'server-only';

import {
  canAccessCheckout,
  isCheckoutEmailProofOwner,
  type CheckoutEmailProof,
  type CheckoutGrant,
} from '../checkoutProof';
import { normalizeRecoveryEmail } from './recoveryOtpUtils';
import type { mapRecoveryCheckoutSummary } from './mapRecoveryCheckoutSummary';

export type RecoveryStartMode = 'review' | 'send-code';
type RecoverySummary = ReturnType<typeof mapRecoveryCheckoutSummary>;
export type RecoveryReviewResponse =
  | { ok: true; recoveryRequired: false }
  | {
      ok: true;
      recoveryRequired: true;
      recoveryVerified: true;
      checkouts: RecoverySummary[];
    };

type RecoveryReviewAccess = {
  email: string;
  userId: string | null;
  grant: CheckoutGrant | null;
  emailProof: CheckoutEmailProof | null;
  browserId: string | null;
  intentUuid?: string;
};

export function canReviewRecoveryEmailProof(access: Omit<RecoveryReviewAccess, 'grant'>) {
  const email = normalizeRecoveryEmail(access.email);
  const proof = access.emailProof;
  return Boolean(
    proof?.verified &&
    isCheckoutEmailProofOwner(proof, access.userId) &&
    normalizeRecoveryEmail(proof.email) === email &&
    access.intentUuid &&
    proof.intentUuid === access.intentUuid &&
    access.browserId &&
    proof.browserId === access.browserId,
  );
}

/** Inputs are decoded server capabilities, never browser-supplied verification claims. */
export function canReviewRecoveryCheckout(
  row: { orderToken: string; userId: string | null; customerEmail: string },
  access: RecoveryReviewAccess,
) {
  if (normalizeRecoveryEmail(row.customerEmail) !== normalizeRecoveryEmail(access.email))
    return false;
  return canAccessCheckout(access.grant, row, access.userId) || canReviewRecoveryEmailProof(access);
}

/** Unknown and unauthorized emails have the same result, with no order-existence disclosure. */
export function recoveryReviewResponse(checkouts: RecoverySummary[]): RecoveryReviewResponse {
  return checkouts.length
    ? { ok: true, recoveryRequired: true, recoveryVerified: true, checkouts }
    : { ok: true, recoveryRequired: false };
}

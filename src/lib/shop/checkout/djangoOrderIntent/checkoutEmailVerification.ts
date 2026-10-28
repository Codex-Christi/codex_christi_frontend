import { isCheckoutEmailProofOwner, type CheckoutEmailProof } from '../checkoutProof';

/** A code for one browser/intent/address must not authorize another checkout. */
export function checkoutEmailChallengeScope(proof: CheckoutEmailProof) {
  if (!proof.browserId) throw new Error('Checkout browser identity is missing.');
  return JSON.stringify([
    'checkout-email-v1',
    proof.browserId,
    proof.ownerId ?? null,
    proof.intentUuid,
    proof.orderId,
    proof.email,
    proof.addressHash,
  ]);
}

export function matchesCheckoutEmailIdentity(
  proof: CheckoutEmailProof | null,
  expected: {
    browserId: string | null;
    intentUuid: string;
    email: string;
    orderId?: string;
    userId?: string | null;
  },
): proof is CheckoutEmailProof {
  return Boolean(
    proof &&
    expected.browserId &&
    proof.browserId === expected.browserId &&
    proof.intentUuid === expected.intentUuid &&
    proof.email === expected.email &&
    (!expected.orderId || proof.orderId === expected.orderId) &&
    isCheckoutEmailProofOwner(proof, expected.userId ?? null),
  );
}

export function canReuseCheckoutEmailProof(
  existing: CheckoutEmailProof | null,
  incoming: CheckoutEmailProof,
  browserId: string | null,
  userId: string | null = null,
) {
  return Boolean(
    existing?.verified &&
    matchesCheckoutEmailIdentity(existing, { ...incoming, browserId, userId }) &&
    existing.addressHash === incoming.addressHash,
  );
}

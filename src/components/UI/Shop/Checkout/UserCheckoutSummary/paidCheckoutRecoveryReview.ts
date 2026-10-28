import type { BasicCheckoutInfoFormSchema } from './BasicCheckoutInfo';

type PaidOrder = { orderToken: string };

export function getRecoveryDraftIdentity(data: BasicCheckoutInfoFormSchema) {
  return JSON.stringify([
    data.email.trim().toLowerCase(),
    data.firstname.trim(),
    data.lastname.trim(),
    data.country.trim().toUpperCase(),
    data.addressLine1.trim(),
    data.addressLine2?.trim() ?? '',
    data.adminArea1.trim(),
    data.adminArea2.trim(),
    data.postalCode.trim(),
  ]);
}

export function getPaidOrderReviewKey(scope: string, orders: readonly PaidOrder[]) {
  return JSON.stringify([scope, [...new Set(orders.map((order) => order.orderToken))].sort()]);
}

/** Closing, replacing a request, or changing its account/cart/details invalidates its result. */
export function createPaidOrderReviewFence(currentScope: () => string, signal: AbortSignal) {
  const scope = currentScope();
  return () => !signal.aborted && currentScope() === scope;
}

export function isReviewedPaidAttempt(
  attempt: { orderToken?: string } | null,
  orders: readonly PaidOrder[],
) {
  return Boolean(
    attempt?.orderToken && orders.some((order) => order.orderToken === attempt.orderToken),
  );
}

export type CheckoutSetupFailure = { code?: string; message: string };

/** Checkout validation and payment routes use different error envelopes. */
export function readCheckoutSetupFailure(payload: unknown): CheckoutSetupFailure {
  const outer = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const nested =
    outer.error && typeof outer.error === 'object' ? (outer.error as Record<string, unknown>) : {};
  const rawCode = outer.code ?? nested.code;
  const code = typeof rawCode === 'string' ? rawCode : undefined;
  const message =
    code === 'CHECKOUT_REVIEW_CHANGED'
      ? 'Prices or delivery changed. Check the updated total and confirm your order again.'
      : code === 'CHECKOUT_EMAIL_VERIFICATION_REQUIRED'
        ? 'Please continue from your contact and delivery details to verify this checkout again.'
        : 'We couldn’t prepare this payment. Your details are still here. Please try again.';
  return { code, message };
}

export function applyCheckoutSetupFailure(
  failure: CheckoutSetupFailure,
  actions: {
    showMessage: (message: string) => void;
    resetReview: () => void;
    refreshQuote: () => void;
    verifyDetails: (message: string) => void;
  },
) {
  actions.showMessage(failure.message);
  if (failure.code === 'CHECKOUT_REVIEW_CHANGED') {
    actions.resetReview();
    actions.refreshQuote();
  } else if (failure.code === 'CHECKOUT_EMAIL_VERIFICATION_REQUIRED') {
    actions.resetReview();
    actions.verifyDetails(failure.message);
  }
}

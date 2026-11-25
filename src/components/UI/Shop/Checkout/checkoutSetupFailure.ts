export type CheckoutSetupFailure = { code?: string; message: string };

/** Checkout validation and payment routes use different error envelopes. */
export function readCheckoutSetupFailure(payload: unknown): CheckoutSetupFailure {
  const outer = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const nested =
    outer.error && typeof outer.error === 'object' ? (outer.error as Record<string, unknown>) : {};
  const rawCode = outer.code ?? nested.code;
  const code = typeof rawCode === 'string' ? rawCode : undefined;
  if (code === 'CHECKOUT_PAUSED') {
    return { code, message: 'New checkouts are paused. You can still check an existing order.' };
  }
  const message =
    code === 'PAYPAL_REVIEW_ADDRESS_CHANGED'
      ? 'PayPal returned a different delivery address. Check the saved checkout before continuing.'
      : code === 'CHECKOUT_REVIEW_REQUIRED'
        ? 'Review and confirm this purchase before continuing.'
        : code === 'CHECKOUT_REVIEW_CHANGED'
          ? 'Your order details changed. Check the updated total and item details, then confirm again.'
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
  if (
    failure.code === 'PAYPAL_REVIEW_ADDRESS_CHANGED' ||
    failure.code === 'CHECKOUT_REVIEW_REQUIRED'
  ) {
    actions.resetReview();
  } else if (failure.code === 'CHECKOUT_REVIEW_CHANGED') {
    actions.resetReview();
    actions.refreshQuote();
  } else if (failure.code === 'CHECKOUT_EMAIL_VERIFICATION_REQUIRED') {
    actions.resetReview();
    actions.verifyDetails(failure.message);
  }
}

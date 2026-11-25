import 'server-only';

import { CheckoutRequestError } from './serverRequest';

export function isNewCheckoutPaused(value = process.env.SHOP_CHECKOUT_PAUSED) {
  const setting = value?.trim().toLowerCase();
  // An unset switch preserves the current behavior; an unrecognized value pauses intake.
  return Boolean(setting) && setting !== 'false';
}

export function requireNewCheckoutOpen() {
  if (isNewCheckoutPaused()) {
    throw new CheckoutRequestError(
      'New checkouts are paused. You can still check an existing order.',
      503,
      'CHECKOUT_PAUSED',
    );
  }
}

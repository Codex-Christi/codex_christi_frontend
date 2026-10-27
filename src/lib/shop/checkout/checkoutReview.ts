import 'server-only';
import { createHash } from 'node:crypto';
import type { CanonicalOrderSnapshot } from '@/lib/paypal/orderSnapshot/types';
import { checkoutAddressHash } from './checkoutProof';
import { CheckoutRequestError, record } from './serverRequest';

export type ReviewedCheckoutQuote = {
  currency: string;
  subtotal: number;
  shipping: number;
  total: number;
};

export function readReviewedCheckoutQuote(value: unknown): ReviewedCheckoutQuote {
  const review = record(value);
  const quote = record(review?.quote);
  if (
    review?.acknowledged !== true ||
    !quote ||
    typeof quote.currency !== 'string' ||
    !/^[A-Z]{3}$/u.test(quote.currency) ||
    ['subtotal', 'shipping', 'total'].some(
      (key) =>
        typeof quote[key] !== 'number' ||
        !Number.isFinite(quote[key]) ||
        (quote[key] as number) < 0,
    )
  )
    throw new CheckoutRequestError(
      'Review and confirm your order before paying.',
      409,
      'CHECKOUT_REVIEW_REQUIRED',
    );
  const checked = quote as ReviewedCheckoutQuote;
  return {
    currency: checked.currency,
    subtotal: checked.subtotal,
    shipping: checked.shipping,
    total: checked.total,
  };
}

export function requireMatchingReview(
  snapshot: CanonicalOrderSnapshot,
  quote: ReviewedCheckoutQuote,
) {
  // Compare the displayed currency amount. Tiny binary floating point tails are formatting noise,
  // but never round a meaningful customer price difference away.
  if (
    quote.currency !== snapshot.currency ||
    (['subtotal', 'shipping', 'total'] as const).some(
      (key) => Math.abs(quote[key] - Number(snapshot[key].value)) > 1e-8,
    )
  )
    throw new CheckoutRequestError(
      'Prices or shipping changed. Review the updated total before paying.',
      409,
      'CHECKOUT_REVIEW_CHANGED',
    );
}

export function checkoutInputFingerprint(input: {
  selections: unknown[];
  email: string;
  name: string;
  address: unknown;
  quote: ReviewedCheckoutQuote;
}) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        selections: input.selections
          .map((item) => {
            const line = record(item);
            return [line?.productId, line?.variantId, line?.quantity];
          })
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
        email: input.email,
        name: input.name,
        address: checkoutAddressHash(input.address),
        quote: [
          input.quote.currency,
          input.quote.subtotal,
          input.quote.shipping,
          input.quote.total,
        ],
      }),
    )
    .digest('hex');
}

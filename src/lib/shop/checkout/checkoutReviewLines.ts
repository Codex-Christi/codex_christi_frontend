import 'server-only';

import { createHash } from 'node:crypto';
import { moneyToMinor } from '@/lib/paypal/orderSnapshot/canonicalize';
import type { CanonicalMoney, CanonicalOrderSnapshot } from '@/lib/paypal/orderSnapshot/types';
import { currencyExponent, type OrderPreviewTotals } from './orderMoney';
import type { CheckoutReviewLine } from './checkoutReviewTypes';

export const CHECKOUT_REVIEW_VERSION = 'checkout-review-v2';

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Use this exact projection for both the preview and the final payment comparison. */
export function canonicalReviewLines(snapshot: CanonicalOrderSnapshot): CheckoutReviewLine[] {
  return snapshot.lines
    .map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      title: line.title,
      selectedOptions: line.selectedOptions
        .map(({ name, value }) => ({ name, value }))
        .sort((a, b) => compare(a.name, b.name) || compare(a.value, b.value)),
      quantity: line.quantity,
      unitAmount: line.unitAmount.value,
      lineAmount: line.lineAmount.value,
    }))
    .sort((a, b) => compare(a.productId, b.productId) || compare(a.variantId, b.variantId));
}

export function canonicalReviewItemsHash(snapshot: CanonicalOrderSnapshot) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        version: 'checkout-review-items-v1',
        currency: snapshot.currency,
        lines: canonicalReviewLines(snapshot),
      }),
    )
    .digest('hex');
}

function displayedAmount(money: CanonicalMoney) {
  const minor = moneyToMinor(money);
  if (minor > BigInt(Number.MAX_SAFE_INTEGER))
    throw new RangeError('The order amount cannot be displayed safely.');
  const divisor = currencyExponent(money.currency) === 0 ? 1 : 100;
  const amount = Number(minor) / divisor;
  if (Math.round(amount * divisor) !== Number(minor))
    throw new RangeError('The order amount cannot be displayed safely.');
  return amount;
}

/** Amounts come straight from the sealed order calculation, with no second conversion. */
export function canonicalReviewPreviewTotals(
  snapshot: CanonicalOrderSnapshot,
  multiplier: number,
): OrderPreviewTotals {
  return {
    currency: snapshot.currency,
    multiplier,
    retailPriceTotalNum: displayedAmount(snapshot.subtotal),
    shippingPriceNum: displayedAmount(snapshot.shipping),
    totalPriceNum: displayedAmount(snapshot.total),
    linePricesByVariantId: Object.fromEntries(
      snapshot.lines.map((line) => [
        line.variantId,
        {
          unitPriceNum: displayedAmount(line.unitAmount),
          lineTotalNum: displayedAmount(line.lineAmount),
        },
      ]),
    ),
  };
}

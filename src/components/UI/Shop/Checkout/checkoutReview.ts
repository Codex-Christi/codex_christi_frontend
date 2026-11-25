import type { CartVariant } from '@/stores/shop_stores/cartStore';
import type { ShopCheckoutStoreInterface } from '@/stores/shop_stores/checkoutStore';
import type { OrderPreviewTotals } from '@/lib/shop/checkout/orderMoney';
import type { CheckoutAttempt } from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import type { CheckoutReviewLine } from '@/lib/shop/checkout/checkoutReviewTypes';

export type CheckoutReview = {
  acknowledged: true;
  quote: { currency: string; subtotal: number; shipping: number; total: number };
  itemsHash?: string;
};
export type CheckoutContact = Pick<
  ShopCheckoutStoreInterface,
  'first_name' | 'last_name' | 'email' | 'delivery_address'
>;

export function createCheckoutInput(
  cart: CartVariant[],
  checkout: CheckoutContact,
  djangoOrderIntentUuid: string,
) {
  return {
    selections: cart
      .map(({ variantId, quantity, itemDetail }) => ({
        productId: itemDetail.product,
        variantId,
        quantity,
      }))
      .sort((a, b) => a.variantId.localeCompare(b.variantId)),
    customer: {
      name: `${checkout.first_name} ${checkout.last_name}`.trim(),
      email: checkout.email ?? '',
    },
    delivery_address: checkout.delivery_address,
    djangoOrderIntentUuid,
  };
}

export const checkoutInputIdentity = (
  input: ReturnType<typeof createCheckoutInput>,
  review: CheckoutReview,
) => JSON.stringify({ ...input, review });
export const hasDifferentBoundCheckout = (attempt: CheckoutAttempt | null, inputKey: string) =>
  Boolean(attempt?.orderToken && attempt.inputKey !== inputKey);

export function createCheckoutReview(
  prices: OrderPreviewTotals,
  itemsHash?: string,
): CheckoutReview {
  return {
    acknowledged: true,
    quote: {
      currency: prices.currency,
      subtotal: prices.retailPriceTotalNum,
      shipping: prices.shippingPriceNum,
      total: prices.totalPriceNum,
    },
    ...(itemsHash ? { itemsHash } : {}),
  };
}

/** A review applies only to the exact customer, destination, items, and server quote shown. */
export function checkoutReviewIdentity(
  cart: CartVariant[],
  checkout: Pick<
    ShopCheckoutStoreInterface,
    'first_name' | 'last_name' | 'email' | 'delivery_address'
  >,
  prices: OrderPreviewTotals,
  reviewLines: CheckoutReviewLine[],
  itemsHash: string,
) {
  return JSON.stringify({
    selections: cart
      .map(({ variantId, quantity, itemDetail }) => ({
        productId: itemDetail.product,
        variantId,
        quantity,
      }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    lines: reviewLines
      .map((line) => ({
        ...line,
        selectedOptions: [...line.selectedOptions].sort(
          (a, b) => a.name.localeCompare(b.name) || a.value.localeCompare(b.value),
        ),
      }))
      .sort((a, b) =>
        `${a.productId}:${a.variantId}`.localeCompare(`${b.productId}:${b.variantId}`),
      ),
    itemsHash,
    customer: [checkout.first_name, checkout.last_name, checkout.email],
    address: checkout.delivery_address,
    quote: createCheckoutReview(prices).quote,
  });
}

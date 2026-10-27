import assert from 'node:assert/strict';
import test from 'node:test';
import type { CartVariant } from '@/lib/cart/types';
import type { OrderPreviewTotals } from '@/lib/shop/checkout/orderMoney';
import {
  checkoutReviewIdentity,
  createCheckoutReview,
  createCheckoutInput,
  checkoutInputIdentity,
  hasDifferentBoundCheckout,
} from './checkoutReview';

const line = (variantId: string, quantity = 1): CartVariant => ({
  variantId,
  quantity,
  title: 'Hoodie',
  slug: 'hoodie',
  itemDetail: {
    _id: variantId,
    image_uris: [],
    retail_price: 20,
    is_default: false,
    title: 'Hoodie',
    options: [],
  },
});
const checkout = {
  first_name: 'Example',
  last_name: 'Customer',
  email: 'customer@example.test',
  delivery_address: {
    shipping_address_line_1: '12 Example Street',
    shipping_address_line_2: '',
    shipping_city: 'Los Angeles',
    shipping_state: 'CA',
    shipping_country: 'USA',
    zip_code: '90001',
  },
};
const prices: OrderPreviewTotals = {
  currency: 'USD',
  multiplier: 1,
  retailPriceTotalNum: 20,
  shippingPriceNum: 5,
  totalPriceNum: 25,
  linePricesByVariantId: { a: { unitPriceNum: 20, lineTotalNum: 20 } },
};

test('review acknowledgment changes with quantities, variants, customer, delivery, or quote', () => {
  const reviewed = checkoutReviewIdentity([line('a')], checkout, prices);
  const changed = [
    checkoutReviewIdentity([line('a', 2)], checkout, prices),
    checkoutReviewIdentity([line('b')], checkout, prices),
    checkoutReviewIdentity([line('a')], { ...checkout, email: 'different@example.test' }, prices),
    checkoutReviewIdentity(
      [line('a')],
      {
        ...checkout,
        delivery_address: {
          ...checkout.delivery_address,
          shipping_address_line_1: '99 Different Street',
        },
      },
      prices,
    ),
    checkoutReviewIdentity([line('a')], checkout, {
      ...prices,
      shippingPriceNum: 8,
      totalPriceNum: 28,
    }),
    checkoutReviewIdentity([line('a')], checkout, { ...prices, currency: 'CAD' }),
  ];
  assert.ok(changed.every((identity) => identity !== reviewed));
});

test('row order alone does not invalidate an unchanged reviewed purchase', () => {
  assert.equal(
    checkoutReviewIdentity([line('a'), line('b')], checkout, prices),
    checkoutReviewIdentity([line('b'), line('a')], checkout, prices),
  );
});

test('review sends the displayed server totals without using cached product prices', () => {
  const review = createCheckoutReview({
    ...prices,
    currency: 'JPY',
    retailPriceTotalNum: 3000,
    shippingPriceNum: 500,
    totalPriceNum: 3500,
  });
  assert.deepEqual(review, {
    acknowledged: true,
    quote: { currency: 'JPY', subtotal: 3000, shipping: 500, total: 3500 },
  });
});

test('a guest checkout remains bound when sign-in merges extra cart quantities', () => {
  const review = createCheckoutReview(prices);
  const originalKey = checkoutInputIdentity(
    createCheckoutInput([line('a')], checkout, 'verified-intent'),
    review,
  );
  const attempt = {
    attemptId: 'original-attempt',
    inputKey: originalKey,
    orderToken: 'possibly-paid-order',
  };
  const mergedKey = checkoutInputIdentity(
    createCheckoutInput([line('a', 3)], checkout, 'verified-intent'),
    review,
  );
  assert.equal(hasDifferentBoundCheckout(attempt, originalKey), false);
  assert.equal(hasDifferentBoundCheckout(attempt, mergedKey), true);
  assert.equal(
    hasDifferentBoundCheckout({ attemptId: 'unbound', inputKey: originalKey }, mergedKey),
    false,
  );
  assert.equal(attempt.orderToken, 'possibly-paid-order');
});

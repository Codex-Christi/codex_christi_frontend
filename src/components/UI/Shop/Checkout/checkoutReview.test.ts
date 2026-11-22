import assert from 'node:assert/strict';
import test from 'node:test';
import type { CartVariant } from '@/lib/cart/types';
import type { OrderPreviewTotals } from '@/lib/shop/checkout/orderMoney';
import type { CheckoutReviewLine } from '@/lib/shop/checkout/checkoutReviewTypes';
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
    product: 'product-a',
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

const reviewLine = (variantId: string, quantity = 1): CheckoutReviewLine => ({
  productId: 'product-a',
  variantId,
  title: 'Verified hoodie',
  selectedOptions: [
    { name: 'Size', value: 'M' },
    { name: 'Label', value: 'Grace design' },
  ],
  quantity,
  unitAmount: '20.00',
  lineAmount: (20 * quantity).toFixed(2),
});

function identity(
  cart: CartVariant[],
  contact = checkout,
  totals = prices,
  reviewLines = cart.map(({ variantId, quantity }) => reviewLine(variantId, quantity)),
  itemsHash = 'trusted-items-hash',
) {
  return checkoutReviewIdentity(cart, contact, totals, reviewLines, itemsHash);
}

test('review acknowledgment changes with quantities, variants, customer, delivery, or quote', () => {
  const reviewed = identity([line('a')]);
  const changed = [
    identity([line('a', 2)]),
    identity([line('b')]),
    identity([line('a')], { ...checkout, email: 'different@example.test' }),
    identity(
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
    identity([line('a')], checkout, {
      ...prices,
      shippingPriceNum: 8,
      totalPriceNum: 28,
    }),
    identity([line('a')], checkout, { ...prices, currency: 'CAD' }),
  ];
  assert.ok(changed.every((identity) => identity !== reviewed));
});

test('row order alone does not invalidate an unchanged reviewed purchase', () => {
  assert.equal(identity([line('a'), line('b')]), identity([line('b'), line('a')]));
});

test('review acknowledgment changes for every rendered item fact even when totals stay equal', () => {
  const original = reviewLine('a');
  const reviewed = identity([line('a')], checkout, prices, [original]);
  for (const changed of [
    { ...original, title: 'Updated product title' },
    { ...original, productId: 'different-product' },
    { ...original, quantity: 2 },
    { ...original, unitAmount: '21.00' },
    { ...original, lineAmount: '21.00' },
    {
      ...original,
      selectedOptions: [
        { name: 'Size', value: 'L' },
        { name: 'Label', value: 'Grace design' },
      ],
    },
    {
      ...original,
      selectedOptions: [
        { name: 'Size', value: 'M' },
        { name: 'Design', value: 'New artwork' },
      ],
    },
  ]) {
    assert.notEqual(identity([line('a')], checkout, prices, [changed]), reviewed);
  }
  assert.notEqual(
    identity([line('a')], checkout, prices, [original], 'renewed-items-hash'),
    reviewed,
  );
  const changedProduct = line('a');
  changedProduct.itemDetail.product = 'different-product';
  assert.notEqual(identity([changedProduct], checkout, prices, [original]), reviewed);
});

test('option order alone does not invalidate the same reviewed selection', () => {
  const original = reviewLine('a');
  assert.equal(
    identity([line('a')], checkout, prices, [original]),
    identity([line('a')], checkout, prices, [
      { ...original, selectedOptions: [...original.selectedOptions].reverse() },
    ]),
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

test('new review requests carry the trusted item hash while original reviews remain compatible', () => {
  assert.equal(createCheckoutReview(prices, 'trusted-items-hash').itemsHash, 'trusted-items-hash');
  assert.equal('itemsHash' in createCheckoutReview(prices), false);
  assert.notEqual(
    checkoutInputIdentity(
      createCheckoutInput([line('a')], checkout, 'verified-intent'),
      createCheckoutReview(prices, 'first-hash'),
    ),
    checkoutInputIdentity(
      createCheckoutInput([line('a')], checkout, 'verified-intent'),
      createCheckoutReview(prices, 'changed-hash'),
    ),
  );
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

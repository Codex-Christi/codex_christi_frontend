import assert from 'node:assert/strict';
import test from 'node:test';
import { finalizeCanonicalOrderSnapshot } from '@/lib/paypal/orderSnapshot/canonicalize';
import type { CanonicalOrderSnapshotDraft } from '@/lib/paypal/orderSnapshot/types';
import {
  canonicalReviewItemsHash,
  canonicalReviewLines,
  canonicalReviewPreviewTotals,
  CHECKOUT_REVIEW_VERSION,
} from './checkoutReviewLines';
import {
  readReviewedCheckoutItemsHash,
  requireMatchingReviewItems,
  requireSavedCheckoutReview,
} from './checkoutReview';
import { CheckoutRequestError } from './serverRequest';

function draft(): CanonicalOrderSnapshotDraft {
  return {
    version: 'shop-alpha-order-v1',
    hashAlgorithm: 'sha256',
    createdAt: '2026-11-21T00:00:00.000Z',
    destination: { countryIso3: 'USA', region: null },
    currency: 'USD',
    lines: [
      {
        lineId: 'p:v',
        productId: 'p',
        variantId: 'v',
        supplierProductId: 'private-product',
        supplierVariantId: 'private-variant',
        sku: 'PRIVATE-SKU',
        sellerSku: null,
        title: 'Verified shirt',
        selectedOptions: [
          { name: 'Size', value: 'M' },
          { name: 'Color', value: 'Blue' },
        ],
        imageUrl: 'https://private.invalid/image.jpg',
        quantity: 2,
        unitAmount: { currency: 'USD', value: '10.00' },
        lineAmount: { currency: 'USD', value: '20.00' },
        shippingAllocation: { currency: 'USD', value: '5.00' },
      },
    ],
    subtotal: { currency: 'USD', value: '20.00' },
    shipping: { currency: 'USD', value: '5.00' },
    total: { currency: 'USD', value: '25.00' },
  };
}

test('review lines expose the exact server purchase without supplier details', () => {
  const snapshot = finalizeCanonicalOrderSnapshot(draft());
  assert.deepEqual(canonicalReviewLines(snapshot), [
    {
      productId: 'p',
      variantId: 'v',
      title: 'Verified shirt',
      selectedOptions: [
        { name: 'Color', value: 'Blue' },
        { name: 'Size', value: 'M' },
      ],
      quantity: 2,
      unitAmount: '10.00',
      lineAmount: '20.00',
    },
  ]);
  assert.doesNotMatch(
    JSON.stringify(canonicalReviewLines(snapshot)),
    /PRIVATE|private|sku|supplier|image/,
  );
  assert.deepEqual(canonicalReviewPreviewTotals(snapshot, 1), {
    currency: 'USD',
    multiplier: 1,
    retailPriceTotalNum: 20,
    shippingPriceNum: 5,
    totalPriceNum: 25,
    linePricesByVariantId: { v: { unitPriceNum: 10, lineTotalNum: 20 } },
  });
});

test('review hash ignores timestamps and supplier details and normalizes option and line order', () => {
  const first = draft();
  first.lines.push({ ...first.lines[0], lineId: 'q:w', productId: 'q', variantId: 'w' });
  first.subtotal.value = '40.00';
  first.shipping.value = '10.00';
  first.total.value = '50.00';
  const second = structuredClone(first);
  second.createdAt = '2026-11-22T00:00:00.000Z';
  second.lines.reverse();
  second.lines.forEach((line) => {
    line.selectedOptions.reverse();
    line.sku = 'OTHER-SKU';
    line.imageUrl = '/other.jpg';
  });
  assert.equal(
    canonicalReviewItemsHash(finalizeCanonicalOrderSnapshot(first)),
    canonicalReviewItemsHash(finalizeCanonicalOrderSnapshot(second)),
  );
});

test('same-price changes to product, variant, title, options and quantity change the review hash', () => {
  const original = finalizeCanonicalOrderSnapshot(draft());
  for (const change of [
    { productId: 'another-product' },
    { variantId: 'another-variant' },
    { title: 'Another shirt' },
    { selectedOptions: [{ name: 'Size', value: 'L' }] },
    { quantity: 1, unitAmount: { currency: 'USD', value: '20.00' } },
  ]) {
    const changed = draft();
    Object.assign(changed.lines[0], change);
    assert.notEqual(
      canonicalReviewItemsHash(finalizeCanonicalOrderSnapshot(changed)),
      canonicalReviewItemsHash(original),
    );
  }
});

test('review totals preserve zero-digit amounts and reject unsafe display numbers', () => {
  const zero = draft();
  zero.currency = 'JPY';
  for (const money of [
    zero.subtotal,
    zero.shipping,
    zero.total,
    zero.lines[0].unitAmount,
    zero.lines[0].lineAmount,
    zero.lines[0].shippingAllocation,
  ]) {
    money.currency = 'JPY';
    money.value = String(Number(money.value) * 100);
  }
  const snapshot = finalizeCanonicalOrderSnapshot(zero);
  assert.equal(canonicalReviewPreviewTotals(snapshot, 150).totalPriceNum, 2500);
  const unsafe = draft();
  unsafe.lines[0].quantity = 1;
  unsafe.lines[0].unitAmount.value =
    unsafe.lines[0].lineAmount.value =
    unsafe.subtotal.value =
      '90071992547410.00';
  unsafe.total.value = '90071992547415.00';
  assert.throws(
    () => canonicalReviewPreviewTotals(finalizeCanonicalOrderSnapshot(unsafe), 1),
    RangeError,
  );
});

test('new reviews require an exact well-formed item hash, while explicit legacy retries may omit it', () => {
  const snapshot = finalizeCanonicalOrderSnapshot(draft());
  assert.equal(readReviewedCheckoutItemsHash({}), undefined);
  for (const itemsHash of [null, '', 'wrong', 'A'.repeat(64)])
    assert.throws(() => readReviewedCheckoutItemsHash({ itemsHash }), CheckoutRequestError);
  assert.throws(() => requireMatchingReviewItems(snapshot, undefined), CheckoutRequestError);
  assert.throws(
    () => requireMatchingReviewItems(snapshot, '0'.repeat(64)),
    (error) => error instanceof CheckoutRequestError && error.code === 'CHECKOUT_REVIEW_CHANGED',
  );
  requireMatchingReviewItems(snapshot, canonicalReviewItemsHash(snapshot));
  requireMatchingReviewItems(snapshot, undefined, true);
});

test('persisted v2 acknowledgement binds policy, time, canonical snapshot, displayed items and quote', () => {
  const snapshot = finalizeCanonicalOrderSnapshot(draft());
  const review = {
    version: CHECKOUT_REVIEW_VERSION,
    acknowledgedAt: '2026-11-21T00:00:00.000Z',
    canonicalSnapshotHash: snapshot.hash,
    itemsHash: canonicalReviewItemsHash(snapshot),
    requestFingerprint: 'a'.repeat(64),
    quote: { currency: 'USD', subtotal: 20, shipping: 5, total: 25 },
  };
  requireSavedCheckoutReview(snapshot, { verified: true, review });
  for (const change of [
    { version: 'unknown' },
    { acknowledgedAt: 'yesterday' },
    { canonicalSnapshotHash: '0'.repeat(64) },
    { itemsHash: undefined },
    { itemsHash: '0'.repeat(64) },
    { requestFingerprint: '' },
    { quote: { ...review.quote, total: 24.99 } },
    { version: 'checkout-review-v1' },
  ])
    assert.throws(
      () =>
        requireSavedCheckoutReview(snapshot, { verified: true, review: { ...review, ...change } }),
      CheckoutRequestError,
    );
  assert.throws(
    () => requireSavedCheckoutReview(null, { verified: true, review }),
    CheckoutRequestError,
  );
  assert.throws(
    () => requireSavedCheckoutReview(snapshot, { verified: false, review }),
    CheckoutRequestError,
  );
  const { canonicalSnapshotHash, itemsHash, ...legacyReview } = review;
  assert.ok(canonicalSnapshotHash && itemsHash);
  requireSavedCheckoutReview(snapshot, {
    verified: true,
    review: { ...legacyReview, version: 'checkout-review-v1' },
  });
  for (const payload of [
    null,
    { verified: true },
    { verified: true, review: { version: 'checkout-review-v1' } },
  ])
    assert.throws(() => requireSavedCheckoutReview(snapshot, payload), CheckoutRequestError);
  requireSavedCheckoutReview(null, null);
});

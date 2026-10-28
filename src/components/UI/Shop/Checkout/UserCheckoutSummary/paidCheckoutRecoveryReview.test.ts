import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPaidOrderReviewFence,
  getPaidOrderReviewKey,
  getRecoveryDraftIdentity,
  isReviewedPaidAttempt,
} from './paidCheckoutRecoveryReview';

const draft = {
  firstname: 'Checkout',
  lastname: 'Customer',
  email: 'customer@example.test',
  country: 'USA',
  addressLine1: '123 Test Street',
  addressLine2: '',
  adminArea1: 'CA',
  adminArea2: 'San Jose',
  postalCode: '95131',
};

test('a separate-purchase acknowledgement is tied to the current draft, account and paid orders', () => {
  const scope = getRecoveryDraftIdentity(draft);
  const orders = [{ orderToken: 'paid-1' }, { orderToken: 'paid-2' }];
  const acknowledged = getPaidOrderReviewKey(`owner-1:${scope}`, orders);
  assert.equal(acknowledged, getPaidOrderReviewKey(`owner-1:${scope}`, orders.toReversed()));
  assert.equal(
    scope,
    getRecoveryDraftIdentity({ ...draft, email: ' CUSTOMER@EXAMPLE.TEST ', country: 'usa' }),
  );
  for (const changed of [
    { ...draft, email: 'other@example.test' },
    { ...draft, addressLine1: '456 Other Street' },
    { ...draft, postalCode: '95132' },
  ])
    assert.notEqual(
      acknowledged,
      getPaidOrderReviewKey(`owner-1:${getRecoveryDraftIdentity(changed)}`, orders),
    );
  assert.notEqual(acknowledged, getPaidOrderReviewKey(`owner-2:${scope}`, orders));
  assert.notEqual(
    acknowledged,
    getPaidOrderReviewKey(`owner-1:${scope}`, [...orders, { orderToken: 'paid-3' }]),
  );
});

test('a closed or replaced review cannot publish a late order summary', () => {
  const controller = new AbortController();
  const current = createPaidOrderReviewFence(() => 'same checkout', controller.signal);
  assert.equal(current(), true);
  controller.abort();
  assert.equal(current(), false);
});

test('account, cart, or contact changes invalidate an in-flight review', () => {
  for (const next of ['another account', 'different cart', 'changed contact details']) {
    let scope = 'original checkout';
    const current = createPaidOrderReviewFence(() => scope, new AbortController().signal);
    scope = next;
    assert.equal(current(), false);
  }
});

test('reviewing one paid order never authorizes clearing an unrelated PayPal attempt', () => {
  const paid = [{ orderToken: 'already-paid' }];
  assert.equal(isReviewedPaidAttempt({ orderToken: 'already-paid' }, paid), true);
  assert.equal(isReviewedPaidAttempt({ orderToken: 'still-confirming' }, paid), false);
  assert.equal(isReviewedPaidAttempt({ orderToken: 'not-yet-approved' }, paid), false);
  assert.equal(isReviewedPaidAttempt({}, paid), false);
  assert.equal(isReviewedPaidAttempt(null, paid), false);
});

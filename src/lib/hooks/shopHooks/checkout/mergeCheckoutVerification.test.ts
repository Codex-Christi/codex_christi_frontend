import assert from 'node:assert/strict';
import test from 'node:test';
import type { DjangoOrderIntentAPIResponse } from './djangoOrderIntentMutationHooks';
import { mergeCheckoutVerification } from './mergeCheckoutVerification';

const created = {
  success: true,
  data: {
    id: 'intent',
    order_id: 'order',
    email: 'Buyer@example.test',
    address: '123 Test Street',
    city: 'San Jose',
    country: 'USA',
    otp_status: 'pending',
  },
};
const verified = {
  success: true,
  emailVerificationMethod: 'next-otp',
  data: {
    id: 'intent',
    order_id: 'order',
    email: 'buyer@example.test',
    otp_status: 'verified',
  },
} as DjangoOrderIntentAPIResponse;

test('Next email verification preserves matching checkout display details', () => {
  const result = mergeCheckoutVerification(verified, created);
  assert.equal(result.data.address, created.data.address);
  assert.equal(result.data.city, created.data.city);
  assert.equal(result.data.country, created.data.country);
  assert.equal(result.data.otp_status, 'verified');
  assert.equal(created.data.otp_status, 'pending');
});

test('email verification cannot revive another checkout or unverified response', () => {
  for (const changed of [
    { id: 'another-intent' },
    { order_id: 'another-order' },
    { email: 'someone-else@example.test' },
    { otp_status: 'pending' },
  ]) {
    const response = { ...verified, data: { ...verified.data, ...changed } };
    assert.throws(() =>
      mergeCheckoutVerification(response as DjangoOrderIntentAPIResponse, created),
    );
  }
  assert.throws(() => mergeCheckoutVerification(verified, null));
  assert.throws(() => mergeCheckoutVerification(verified, { ...created, success: false }));
});

test('upstream Django verification retains its complete response', () => {
  const response = { ...verified, emailVerificationMethod: undefined };
  assert.equal(mergeCheckoutVerification(response, null), response);
});

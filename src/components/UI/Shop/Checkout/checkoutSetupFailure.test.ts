import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCheckoutSetupFailure, readCheckoutSetupFailure } from './checkoutSetupFailure';

function handle(payload: unknown) {
  const events: string[] = [];
  const failure = readCheckoutSetupFailure(payload);
  applyCheckoutSetupFailure(failure, {
    showMessage: () => events.push('message'),
    resetReview: () => events.push('clear-acknowledgment'),
    refreshQuote: () => events.push('refresh-current-quote'),
    verifyDetails: () => events.push('return-to-contact-verification'),
  });
  return { events, failure };
}

test('top-level changed-price validation resets acknowledgment and refreshes the reviewed quote', () => {
  const { events, failure } = handle({
    ok: false,
    code: 'CHECKOUT_REVIEW_CHANGED',
    message: 'Internal canonical snapshot details',
  });
  assert.deepEqual(events, ['message', 'clear-acknowledgment', 'refresh-current-quote']);
  assert.match(failure.message, /Check the updated total/);
  assert.doesNotMatch(failure.message, /canonical snapshot/);
});

test('both route envelopes return expired verification to contact without retrying payment', () => {
  for (const payload of [
    { ok: false, code: 'CHECKOUT_EMAIL_VERIFICATION_REQUIRED' },
    { error: { code: 'CHECKOUT_EMAIL_VERIFICATION_REQUIRED' } },
  ]) {
    assert.deepEqual(handle(payload).events, [
      'message',
      'clear-acknowledgment',
      'return-to-contact-verification',
    ]);
  }
});

test('unknown and malformed failures keep details and display a retry message', () => {
  for (const payload of [null, { error: 'Unavailable' }, { message: 'SECRET_INTERNAL_DETAIL' }]) {
    const { events, failure } = handle(payload);
    assert.deepEqual(events, ['message']);
    assert.match(failure.message, /details are still here/);
    assert.doesNotMatch(failure.message, /SECRET/);
  }
});

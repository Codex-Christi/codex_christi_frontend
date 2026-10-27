import assert from 'node:assert/strict';
import test from 'node:test';
import {
  beginCheckoutAttempt,
  captureCheckoutAttempt,
  completeCheckoutAttempt,
  setCheckoutAttemptStage,
  usePayPalIntentStore,
} from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import { canStartSeparateCheckout, startSeparateCheckout } from './checkoutAttemptRecovery';
import { finalizePayPalAttempt } from './finalizePayPalAttempt';
import { deferred } from '@/lib/cart/test-support';

usePayPalIntentStore.persist.setOptions({
  storage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
});
function setup() {
  usePayPalIntentStore.getState().clearIntent();
  const attempt = beginCheckoutAttempt('original-details');
  completeCheckoutAttempt(attempt, {
    orderToken: 'original-order',
    paypalOrderId: 'original-paypal-order',
  });
  return captureCheckoutAttempt()!;
}
const unpaid = { orderToken: 'original-order', status: 'intent_created' };

test('changed cart cannot replace its bound checkout until an explicit separate-order choice uses unpaid evidence', () => {
  const attempt = setup();
  assert.throws(() => beginCheckoutAttempt('merged-cart'), /earlier payment/);
  assert.equal(captureCheckoutAttempt()?.attemptId, attempt.attemptId);
  assert.equal(canStartSeparateCheckout(attempt, unpaid), true);
  assert.equal(startSeparateCheckout(attempt, unpaid), true);
  assert.notEqual(beginCheckoutAttempt('merged-cart').attemptId, attempt.attemptId);
});

test('paid, authorized, pending, failed, mismatched, or ambiguous evidence never clears the earlier order', () => {
  const attempt = setup();
  for (const status of [
    'authorized',
    'pending',
    'captured',
    'completed',
    'error',
    'refunded',
    'intent_creating',
  ]) {
    assert.equal(startSeparateCheckout(attempt, { ...unpaid, status }), false);
  }
  for (const evidence of [
    { paidAmountLabel: '$10' },
    { cartPurchase: { orderId: 'original-order', lines: [] } },
    { lastEventType: 'CHECKOUT.ORDER.APPROVED' },
    { error: { code: 'UNKNOWN' } },
    { orderToken: 'another-order' },
    { receiptLink: '/receipt' },
  ])
    assert.equal(startSeparateCheckout(attempt, { ...unpaid, ...evidence }), false);
  assert.equal(captureCheckoutAttempt()?.attemptId, attempt.attemptId);
});

test('fresh evidence that changed since the first check prevents starting a separate order', () => {
  const attempt = setup();
  assert.equal(canStartSeparateCheckout(attempt, unpaid), true);
  assert.equal(startSeparateCheckout(attempt, { ...unpaid, status: 'authorized' }), false);
  assert.equal(captureCheckoutAttempt()?.orderToken, 'original-order');
});

test('a cancellation callback or hidden banner cannot make an in-flight authorization safe to replace', async () => {
  const attempt = setup();
  const response = deferred<Response>();
  const work = finalizePayPalAttempt(attempt, attempt.paypalOrderId!, {
    request: async () => response.promise,
    onCompleted: () => assert.fail('unconfirmed authorization completed'),
  });
  assert.equal(setCheckoutAttemptStage(attempt, 'paypal_cancelled'), false);
  usePayPalIntentStore.getState().clearActiveCheckout();
  assert.equal(startSeparateCheckout(attempt, unpaid), false);
  response.resolve(Response.json({}, { status: 500 }));
  await assert.rejects(work);
  assert.equal(captureCheckoutAttempt()?.attemptId, attempt.attemptId);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { getCustomerPostPurchaseStage, getCustomerRecoveryReason } from './customerRecoveryCopy';

test('customer copy distinguishes checking delivery details from an explicit release hold', () => {
  assert.match(
    getCustomerRecoveryReason('payment_saved', 'MERCHIZE_ADDRESS_VALIDATION_PENDING', true),
    /checking your delivery address.*No action is needed/,
  );
  assert.match(
    getCustomerRecoveryReason(
      'fulfillment_attention_required',
      'MERCHIZE_PUSH_DISABLED_BY_CONFIG',
      true,
    ),
    /when preparation begins/,
  );
  assert.match(getCustomerRecoveryReason('captured', null, true), /receipt is ready/);
  assert.match(getCustomerRecoveryReason('captured', null, false), /receipt is taking longer/);
  assert.doesNotMatch(
    getCustomerRecoveryReason('error', 'private-provider-code', false),
    /private-provider/,
  );
});

test('received and delivery milestones require both confirmed payment and an accepted handoff', () => {
  const accepted = {
    status: 201,
    success: true,
    data: {
      processing_status: 'completed',
      error_message: 'Order created but details not available',
    },
  };
  const evidence = {
    status: 'payment_saved',
    paymentConfirmed: true,
    postPaymentComplete: false,
    fulfillmentResponse: accepted,
    lastErrorCode: null,
  };
  assert.equal(getCustomerPostPurchaseStage(evidence), 'order_received');
  const delivery = { ...evidence, lastErrorCode: 'MERCHIZE_ADDRESS_VALIDATION_PENDING' };
  assert.equal(getCustomerPostPurchaseStage(delivery), 'checking_delivery_details');
  assert.equal(
    getCustomerPostPurchaseStage({
      ...evidence,
      lastErrorCode: 'MERCHIZE_PUSH_DISABLED_BY_CONFIG',
    }),
    'awaiting_preparation',
  );
  for (const patch of [
    { paymentConfirmed: false },
    { postPaymentComplete: true },
    { fulfillmentResponse: { ...accepted, success: false } },
    { fulfillmentResponse: { ...accepted, _nextDjangoAttempt: { outcome: 'uncertain' } } },
    { status: 'refunded' },
  ])
    assert.equal(getCustomerPostPurchaseStage({ ...delivery, ...patch }), null);
  assert.equal(
    getCustomerPostPurchaseStage({ ...evidence, lastErrorCode: 'MERCHIZE_ORDER_STATE_UNCERTAIN' }),
    null,
  );
});

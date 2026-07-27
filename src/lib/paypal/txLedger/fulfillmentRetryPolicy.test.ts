import assert from 'node:assert/strict';
import test from 'node:test';
import { getMerchizeFulfillmentRetryEligibility } from './fulfillmentRetryPolicy';

const completeCheckpoints = {
  captureComplete: true,
  hasAcceptedDjangoFulfillmentHandoff: true,
  hasDjangoPaymentSaveCustomId: true,
  hasMerchizeExternalOrderNumber: true,
  hasPersistedReceipt: true,
};

test('allows fulfillment-only retry after every payment and handoff checkpoint', () => {
  assert.deepEqual(getMerchizeFulfillmentRetryEligibility(completeCheckpoints), {
    eligible: true,
    mode: 'retry_merchize_fulfillment',
  });
});

test('routes a row missing Django payment save back to post-payment recovery', () => {
  const result = getMerchizeFulfillmentRetryEligibility({
    ...completeCheckpoints,
    hasDjangoPaymentSaveCustomId: false,
  });

  assert.equal(result.eligible, false);
  if (result.eligible) return;
  assert.equal(result.missingCheckpoint, 'django_payment_save');
  assert.equal(result.code, 'MERCHIZE_RETRY_DJANGO_PAYMENT_SAVE_REQUIRED');
});

test('does not accept a Django response without an external Merchize number', () => {
  const result = getMerchizeFulfillmentRetryEligibility({
    ...completeCheckpoints,
    hasMerchizeExternalOrderNumber: false,
  });

  assert.equal(result.eligible, false);
  if (result.eligible) return;
  assert.equal(result.missingCheckpoint, 'merchize_external_order');
});

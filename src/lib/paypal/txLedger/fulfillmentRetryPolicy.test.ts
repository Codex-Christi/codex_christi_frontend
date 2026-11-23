import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getMerchizeFulfillmentRetryEligibility,
  getPendingFulfillmentRetryMessage,
  getPushVerificationPendingMessage,
} from './fulfillmentRetryPolicy';

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

test('reports a pending Merchize check only after an accepted handoff on a saved payment', () => {
  const pending = {
    status: 'payment_saved',
    lastErrorCode: 'MERCHIZE_ADDRESS_VALIDATION_PENDING',
    hasAcceptedDjangoHandoff: true,
  };
  assert.match(
    getPendingFulfillmentRetryMessage(pending) ?? '',
    /delivery address check is still pending/u,
  );
  assert.match(
    getPendingFulfillmentRetryMessage({
      ...pending,
      lastErrorCode: 'MERCHIZE_LOOKUP_PENDING_PROVIDER_PROCESSING',
    }) ?? '',
    /still making the order available/u,
  );
  assert.equal(
    getPendingFulfillmentRetryMessage({
      ...pending,
      lastErrorCode: 'MERCHIZE_PUSH_VERIFICATION_PENDING',
    }),
    getPushVerificationPendingMessage(),
  );
  assert.equal(
    getPendingFulfillmentRetryMessage({ ...pending, hasAcceptedDjangoHandoff: false }),
    null,
  );
  assert.equal(getPendingFulfillmentRetryMessage({ ...pending, status: 'captured' }), null);
  assert.equal(
    getPendingFulfillmentRetryMessage({ ...pending, lastErrorCode: 'MERCHIZE_ADDRESS_INVALID' }),
    null,
  );
});

test('distinguishes a new push acknowledgement from a check of an existing release', () => {
  assert.match(getPushVerificationPendingMessage(true), /acknowledged the push request/u);
  assert.match(getPushVerificationPendingMessage(false), /did not send a new push request/u);
  assert.doesNotMatch(getPushVerificationPendingMessage(), /acknowledged|did not send/u);
  for (const acknowledged of [true, false, undefined]) {
    assert.match(getPushVerificationPendingMessage(acknowledged), /Refresh Merchize state/u);
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getMerchizeFulfillmentRetryEligibility,
  getMerchizeReadyRefreshFeedback,
  getMerchizeReleaseReview,
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
  assert.match(getPushVerificationPendingMessage('acknowledged'), /acknowledged the push request/u);
  assert.match(getPushVerificationPendingMessage('not_sent'), /did not send a new push request/u);
  assert.match(getPushVerificationPendingMessage('unconfirmed'), /did not confirm receipt/u);
  assert.doesNotMatch(getPushVerificationPendingMessage(), /acknowledged|did not send/u);
  for (const outcome of ['acknowledged', 'not_sent', 'unconfirmed', undefined] as const) {
    assert.match(getPushVerificationPendingMessage(outcome), /Refresh Merchize state/u);
  }
});

test('keeps refresh primary without inventing an acknowledgement before or after refresh', () => {
  const order = {
    productionGateStatus: 'push_verification_pending',
    providerPushProgress: 'validating',
    pushAcknowledgedAt: null,
    pushVerifiedAt: null,
  };
  for (const gate of ['push_verification_pending', 'ready', 'push_acknowledged', 'push_pending']) {
    assert.deepEqual(getMerchizeReleaseReview({ ...order, productionGateStatus: gate }), {
      acknowledgementRecorded: false,
      verified: false,
      verificationPending: true,
    });
  }
  assert.equal(getMerchizeReleaseReview({
    ...order, productionGateStatus: 'ready', providerPushProgress: null,
  }).verificationPending, false);
  assert.equal(getMerchizeReleaseReview({
    ...order, productionGateStatus: 'manual_release_required', providerPushProgress: null,
  }).verificationPending, false);
});

test('keeps actual acknowledgement separate from verified release and explicit failure', () => {
  const order = {
    productionGateStatus: 'push_acknowledged',
    providerPushProgress: 'validating',
    pushAcknowledgedAt: '2026-11-23T18:00:00Z',
    pushVerifiedAt: null,
  };
  assert.deepEqual(getMerchizeReleaseReview(order), {
    acknowledgementRecorded: true, verified: false, verificationPending: true,
  });
  assert.deepEqual(getMerchizeReleaseReview({
    ...order, productionGateStatus: 'push_verified', pushAcknowledgedAt: null,
  }), {
    acknowledgementRecorded: false, verified: true, verificationPending: false,
  });
  assert.equal(getMerchizeReleaseReview({
    ...order, productionGateStatus: 'push_failed',
  }).verificationPending, false);
});

test('refresh feedback distinguishes readiness, release verification, and saved details', () => {
  const pending = getMerchizeReadyRefreshFeedback(false, true);
  assert.equal(pending.tone, 'warning');
  assert.equal(pending.heading, 'Release not confirmed');
  assert.match(pending.message, /did not send a push/u);
  assert.match(pending.message, /Refresh Merchize state/u);
  assert.equal(getMerchizeReadyRefreshFeedback(true, false).heading, 'Release confirmed');
  assert.equal(getMerchizeReadyRefreshFeedback(true, true).tone, 'success');
});

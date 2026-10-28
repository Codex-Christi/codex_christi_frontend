import assert from 'node:assert/strict';
import test from 'node:test';
import { getDjangoHandoffReview, runDjangoHandoff } from './djangoHandoff';
import { DjangoOrderError } from './djangoOrderContract';
import {
  FulfillmentPayloadValidationError,
  sendMerchizeFulfillmentOrder,
} from './sendMerchizeFulfillmentOrder';
import {
  isAcceptedDjangoFulfillmentProcessResponse,
  parseDjangoFulfillmentProcessResponse,
} from './fulfillmentProcessResponse';

const accepted = () => ({
  status: 201,
  success: true,
  data: {
    id: 'd73b4b97-3ec0-4163-8a34-55d649404f81',
    order_payment_custom_id: 'payment-1',
    order_intent_id: 'intent-1',
    order_intent_order_id: 'ORD-1',
    processing_status: 'completed',
    error_message: 'Order created but details not available',
    response_data: { extra: 'retained', data: { data: { order_id: 'ORD-1' } } },
  },
});

for (const operation of ['payment_save', 'fulfillment_handoff'] as const) {
  test(`${operation}: a lost reply or checkpoint blocks a second dispatch after restart`, async () => {
    for (const failedCheckpoint of [false, true]) {
      let stored: unknown = null;
      let calls = 0;
      const run = () =>
        runDjangoHandoff({
          operation,
          previousEvidence: structuredClone(stored),
          persistEvidence: async (evidence) => {
            stored = structuredClone(evidence);
          },
          send: async () => {
            calls++;
            if (!failedCheckpoint) throw new Error('Connection lost after upstream committed');
            return accepted();
          },
          response: (value) => value,
          commit: async () => {
            throw new Error('Database checkpoint failed');
          },
        });
      await assert.rejects(run);
      assert.equal(calls, 1);
      await assert.rejects(run, DjangoOrderError);
      assert.equal(calls, 1, 'A fresh execution must not repeat an uncertain POST');
    }
  });

  test(`${operation}: durable write failure prevents dispatch; explicit rejection permits correction`, async () => {
    let calls = 0;
    let stored: unknown = null;
    let failPersist = true;
    let rejectRequest = true;
    const run = () =>
      runDjangoHandoff({
        operation,
        previousEvidence: stored,
        persistEvidence: async (evidence) => {
          if (failPersist) throw new Error('Database unavailable');
          stored = structuredClone(evidence);
        },
        send: async () => {
          calls++;
          if (rejectRequest)
            throw new DjangoOrderError({
              code: 'INVALID_INPUT',
              message: 'Rejected',
              outcome: 'rejected',
              httpStatus: 400,
            });
          return accepted();
        },
        response: (value) => ({ ...value, _nextDjangoAttempt: { outcome: 'uncertain' } }),
        commit: async (_value, evidence) => {
          stored = structuredClone(evidence);
        },
      });
    await assert.rejects(run);
    assert.equal(calls, 0);
    failPersist = false;
    await assert.rejects(run, DjangoOrderError);
    rejectRequest = false;
    await run();
    assert.equal(calls, 2);
    const marker = (stored as { _nextDjangoAttempt: { outcome: string } })._nextDjangoAttempt;
    assert.equal(
      marker.outcome,
      'acknowledged',
      'An upstream field cannot overwrite local attempt state',
    );
  });
}

test('legacy failure holds survive repeated review and accepted checkpoints remain usable', () => {
  for (const code of ['DJANGO_PAYMENT_SAVE_FAILED', 'DJANGO_PAYMENT_SAVE_REVIEW_REQUIRED']) {
    assert.equal(getDjangoHandoffReview({ lastErrorCode: code })?.operation, 'payment_save');
  }
  for (const code of ['DJANGO_FULFILLMENT_HANDOFF_FAILED', 'DJANGO_FULFILLMENT_REVIEW_REQUIRED']) {
    assert.equal(
      getDjangoHandoffReview({ djangoPaymentSaveCustomId: 'payment-1', lastErrorCode: code })
        ?.operation,
      'fulfillment_handoff',
    );
  }
  assert.equal(
    getDjangoHandoffReview({
      djangoPaymentSaveCustomId: 'payment-1',
      merchizeFulfillmentResponsePayload: accepted(),
    }),
    null,
  );
  assert.equal(
    getDjangoHandoffReview({ merchizeFulfillmentResponsePayload: { source: 'local_validation' } }),
    null,
  );
  assert.ok(
    getDjangoHandoffReview({ djangoPaymentSaveResponsePayload: { _nextDjangoAttempt: null } }),
  );
});

test('uncertain success-shaped evidence is not an accepted fulfillment checkpoint', async () => {
  assert.equal(
    isAcceptedDjangoFulfillmentProcessResponse({ ...accepted(), _nextDjangoAttempt: null }),
    false,
  );
  let stored: unknown;
  await assert.rejects(() =>
    runDjangoHandoff({
      operation: 'fulfillment_handoff',
      previousEvidence: null,
      persistEvidence: async (evidence) => {
        stored = evidence;
      },
      send: async () => {
        throw new DjangoOrderError({
          code: 'MISMATCH',
          message: 'Wrong order',
          outcome: 'uncertain',
          responsePayload: accepted(),
        });
      },
      response: (value) => value,
      commit: async () => assert.fail('Unverified replies cannot be committed'),
    }),
  );
  assert.equal(isAcceptedDjangoFulfillmentProcessResponse(stored), false);
  assert.ok(
    getDjangoHandoffReview({
      djangoPaymentSaveCustomId: 'payment-1',
      merchizeFulfillmentResponsePayload: stored,
    }),
  );
});

test('fulfillment replies validate identity, status and shape while retaining unknown fields', () => {
  const expected = { customId: 'payment-1', intentUuid: 'intent-1', orderId: 'ORD-1' };
  assert.equal(
    parseDjangoFulfillmentProcessResponse(accepted(), expected).data.response_data?.extra,
    'retained',
  );
  for (const value of [
    null,
    [],
    {},
    { ...accepted(), success: false },
    { ...accepted(), status: 202 },
    ...[
      { id: 'not-a-uuid' },
      { order_payment_custom_id: 'other' },
      { order_intent_id: 'other' },
      { order_intent_order_id: 'other' },
      { processing_status: 'unknown' },
      { retry_count: -1 },
    ].map((data) => ({ ...accepted(), data: { ...accepted().data, ...data } })),
  ])
    assert.throws(() => parseDjangoFulfillmentProcessResponse(value, expected), DjangoOrderError);
  assert.ok(
    parseDjangoFulfillmentProcessResponse(
      {
        ...accepted(),
        data: { ...accepted().data, order_intent_id: null, order_intent_order_id: undefined },
      },
      expected,
    ),
  );
});

test('local fulfillment validation stays not-sent and preserves its actionable field issues', async (t) => {
  const network = t.mock.method(globalThis, 'fetch', async () =>
    assert.fail('Invalid local payload must not be dispatched'),
  );
  await assert.rejects(
    () =>
      sendMerchizeFulfillmentOrder({
        cartSnapshot: [],
        djangoPaymentSaveCustomId: 'payment-1',
        identifier: 'fixture',
        currency: 'USD',
        customerName: 'Test Customer',
        countryIso2: 'US',
        fulfillmentAddress: {
          shipping_address_line_1: '',
          shipping_address_line_2: '',
          shipping_city: '',
          shipping_state: '',
          zip_code: '',
          shipping_country: 'USA',
        },
      }),
    (error) =>
      error instanceof FulfillmentPayloadValidationError &&
      error.failure.outcome === 'not_sent' &&
      error.issues.length > 0,
  );
  assert.equal(network.mock.callCount(), 0);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyMerchizeProductionReadiness } from './productionReadiness';

function readyPayloads(overrides: Record<string, unknown> = {}) {
  return {
    detail: {
      success: true,
      data: {
        validate_shipping_address: 'valid',
        mark_valid_address: false,
        artwork_status: 'ready',
        order_status: 'open',
        paid_at: '2026-07-20T12:00:00.000Z',
        push_to_fulfillment_progress: '',
      },
    },
    addressSuggestion: { success: true, data: [] },
    unfulfilledItems: {
      success: true,
      data: [
        {
          ffm_map_item_status: 'pending',
          product: { is_active: true, is_deleted: false, mapping_status: 'mapped' },
          variant: { is_active: true, is_deleted: false },
        },
      ],
    },
    fulfillmentCost: { success: true, data: { amount: 12, currency: 'USD' } },
    requireAttention: { success: true, data: [] },
    sendToFulfillment: { success: true, data: { pushed: false, is_failed: false } },
    now: new Date('2026-07-21T12:00:00.000Z'),
    ...overrides,
  };
}

test('allows a current order only when explicit provider readiness evidence passes', () => {
  const readiness = classifyMerchizeProductionReadiness(readyPayloads());

  assert.equal(readiness.status, 'ready');
  assert.equal(readiness.ready, true);
  assert.deepEqual(readiness.blockers, []);
});

test('does not treat an empty suggestion list as proof that an invalid address is valid', () => {
  const readiness = classifyMerchizeProductionReadiness(
    readyPayloads({
      detail: {
        success: true,
        data: {
          validate_shipping_address: 'street_undefined',
          mark_valid_address: false,
          artwork_status: 'ready',
          order_status: 'open',
          paid_at: '2026-07-20T12:00:00.000Z',
        },
      },
    }),
  );

  assert.equal(readiness.ready, false);
  assert.equal(readiness.addressReviewStatus, 'blocked');
  assert.equal(readiness.primaryBlocker?.code, 'MERCHIZE_ADDRESS_INVALID');
});

test('honors an explicit provider buyer-confirmed address marker', () => {
  const readiness = classifyMerchizeProductionReadiness(
    readyPayloads({
      detail: {
        success: true,
        data: {
          validate_shipping_address: 'street_undefined',
          mark_valid_address: true,
          artwork_status: 'ready',
          order_status: 'open',
          paid_at: '2026-07-20T12:00:00.000Z',
        },
      },
    }),
  );

  assert.equal(readiness.ready, true);
  assert.equal(readiness.addressReviewStatus, 'buyer_confirmed');
});

test('requires master-admin release for an order older than seven days', () => {
  const payloads = readyPayloads({
    detail: {
      success: true,
      data: {
        validate_shipping_address: 'valid',
        artwork_status: 'ready',
        order_status: 'open',
        paid_at: '2026-07-01T12:00:00.000Z',
      },
    },
  });
  const blocked = classifyMerchizeProductionReadiness(payloads);
  const authorized = classifyMerchizeProductionReadiness({
    ...payloads,
    allowStaleOrderManualRelease: true,
  });

  assert.equal(blocked.status, 'manual_release_required');
  assert.equal(blocked.primaryBlocker?.code, 'MERCHIZE_MANUAL_RELEASE_REQUIRED');
  assert.equal(authorized.ready, true);
  assert.equal(authorized.manualReleaseRequired, true);
});

test('blocks inactive catalog products, missing artwork, and unavailable cost evidence', () => {
  const readiness = classifyMerchizeProductionReadiness(
    readyPayloads({
      detail: {
        success: true,
        data: {
          validate_shipping_address: 'valid',
          artwork_status: 'missing',
          order_status: 'open',
          paid_at: '2026-07-20T12:00:00.000Z',
        },
      },
      unfulfilledItems: {
        success: true,
        data: [{ product: { is_active: false, is_deleted: true, mapping_status: 'unmapped' } }],
      },
      fulfillmentCost: { success: false, message: 'Catalog mapping failed.' },
    }),
  );
  const codes = readiness.blockers.map((blocker) => blocker.code);

  assert.ok(codes.includes('MERCHIZE_PRODUCT_UNAVAILABLE'));
  assert.ok(codes.includes('MERCHIZE_CATALOG_MAPPING_REQUIRED'));
  assert.ok(codes.includes('MERCHIZE_ARTWORK_MISSING'));
  assert.ok(codes.includes('MERCHIZE_FULFILLMENT_COST_UNAVAILABLE'));
});

test('keeps a provider-processing cost response scanner-retryable', () => {
  const readiness = classifyMerchizeProductionReadiness(
    readyPayloads({
      fulfillmentCost: {
        success: false,
        data: null,
        message: 'Order is being processed. Please wait.',
      },
    }),
  );

  assert.equal(readiness.status, 'pending');
  assert.equal(readiness.costReviewStatus, 'pending');
  assert.equal(readiness.primaryBlocker?.code, 'MERCHIZE_FULFILLMENT_COST_PENDING');
  assert.equal(readiness.primaryBlocker?.retryable, true);
});

test('does not treat a successful envelope with null cost data as readiness evidence', () => {
  const readiness = classifyMerchizeProductionReadiness(
    readyPayloads({ fulfillmentCost: { success: true, data: null } }),
  );

  assert.equal(readiness.status, 'pending');
  assert.equal(readiness.costReviewStatus, 'pending');
  assert.equal(readiness.primaryBlocker?.code, 'MERCHIZE_FULFILLMENT_COST_PENDING');
});

test('recognizes provider push evidence instead of requiring another push command', () => {
  const readiness = classifyMerchizeProductionReadiness(
    readyPayloads({
      detail: {
        success: true,
        data: {
          validate_shipping_address: 'valid',
          artwork_status: 'ready',
          order_status: 'open',
          paid_at: '2026-07-20T12:00:00.000Z',
          push_to_fulfillment_progress: 'pushed',
        },
      },
    }),
  );

  assert.equal(readiness.status, 'already_pushed');
  assert.equal(readiness.providerPushState, 'pushed');
});

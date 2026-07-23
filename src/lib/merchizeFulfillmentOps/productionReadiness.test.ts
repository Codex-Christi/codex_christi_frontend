import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canManuallyConfirmMerchizeAddressStatus,
  classifyMerchizeProductionReadiness,
  getMerchizeAddressValidationEvidence,
} from './productionReadiness';

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
    fulfillmentInvoice: {
      success: true,
      data: [
        {
          code: 'RX-TEST',
          external_number: 'ORD-TEST',
          identifier: 'codexchristi-shop',
          fulfillment_cost: {
            amount: 12,
            currency: 'USD',
            status: 'paid',
          },
        },
      ],
    },
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

test('limits manual address confirmation to provider-confirmable statuses', () => {
  assert.equal(canManuallyConfirmMerchizeAddressStatus('street_undefined'), true);
  assert.equal(canManuallyConfirmMerchizeAddressStatus('pending'), true);
  assert.equal(canManuallyConfirmMerchizeAddressStatus('invalid'), false);
  assert.equal(canManuallyConfirmMerchizeAddressStatus('valid'), false);
  assert.deepEqual(
    getMerchizeAddressValidationEvidence({
      success: true,
      data: {
        validate_shipping_address: 'STREET_UNDEFINED',
        mark_valid_address: false,
      },
    }),
    {
      status: 'street_undefined',
      markedValid: false,
    },
  );
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

test('uses explicit item evidence without inferring product failures from invoice text', () => {
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
    }),
  );
  const codes = readiness.blockers.map((blocker) => blocker.code);

  assert.ok(codes.includes('MERCHIZE_PRODUCT_UNAVAILABLE'));
  assert.ok(codes.includes('MERCHIZE_CATALOG_MAPPING_REQUIRED'));
  assert.ok(codes.includes('MERCHIZE_ARTWORK_MISSING'));
  assert.ok(!codes.includes('MERCHIZE_INVOICE_LOOKUP_FAILED'));
  assert.equal(readiness.costReviewStatus, 'paid');
});

test('maps a documented rejected invoice envelope to one generic retryable error', () => {
  const readiness = classifyMerchizeProductionReadiness(
    readyPayloads({
      fulfillmentInvoice: {
        success: false,
        message: 'Provider-specific invoice error.',
      },
    }),
  );

  assert.equal(readiness.status, 'pending');
  assert.equal(readiness.costReviewStatus, 'provider_error');
  assert.equal(readiness.primaryBlocker?.code, 'MERCHIZE_INVOICE_LOOKUP_FAILED');
  assert.equal(readiness.primaryBlocker?.category, 'cost');
  assert.equal(readiness.primaryBlocker?.retryable, true);
});

test('fails closed on an invoice response outside the documented envelope', () => {
  const readiness = classifyMerchizeProductionReadiness(
    readyPayloads({
      fulfillmentInvoice: {
        message: 'Unexpected response shape.',
        data: {},
      },
    }),
  );

  assert.equal(readiness.status, 'pending');
  assert.equal(readiness.costReviewStatus, 'provider_error');
  assert.equal(readiness.primaryBlocker?.code, 'MERCHIZE_INVOICE_LOOKUP_FAILED');
});

test('does not convert an invoice error message into a product-mapping failure', () => {
  const readiness = classifyMerchizeProductionReadiness(
    readyPayloads({
      unfulfilledItems: {
        success: true,
        data: [
          {
            ffm_map_item_status: 'pending',
            ffm_mapped_catalog_sku: null,
            catalogInfo: { sku: 'TEST-CATALOG-SKU' },
            variant: {
              is_active: true,
              is_deleted: false,
              sku: 'TEST-CATALOG-SKU',
              seller_sku: 'TEST-SELLER-SKU',
            },
          },
        ],
      },
      fulfillmentInvoice: {
        success: false,
        message: 'FIND_VARIANT_ERROR: there are some item not mapped.',
      },
    }),
  );

  assert.equal(readiness.itemReviewStatus, 'ready');
  assert.equal(readiness.costReviewStatus, 'provider_error');
  assert.ok(
    !readiness.blockers.some((blocker) => blocker.code === 'MERCHIZE_CATALOG_MAPPING_REQUIRED'),
  );
  assert.equal(readiness.primaryBlocker?.code, 'MERCHIZE_INVOICE_LOOKUP_FAILED');
});

test('ignores inactive flags buried in unrelated nested provider metadata', () => {
  const readiness = classifyMerchizeProductionReadiness(
    readyPayloads({
      unfulfilledItems: {
        success: true,
        data: [
          {
            ffm_map_item_status: 'pending',
            product: { is_active: true, is_deleted: false, mapping_status: 'mapped' },
            variant: { is_active: true, is_deleted: false },
            history: { previous_product: { is_active: false, is_deleted: true } },
          },
        ],
      },
    }),
  );

  assert.equal(readiness.ready, true);
  assert.equal(readiness.itemReviewStatus, 'ready');
});

test('does not treat stale seller-product flags as current variant unavailability', () => {
  const readiness = classifyMerchizeProductionReadiness(
    readyPayloads({
      unfulfilledItems: {
        success: true,
        data: [
          {
            ffm_map_item_status: 'pending',
            catalogInfo: { sku: 'TEST-CATALOG-SKU' },
            product: { is_active: false, is_deleted: true, mapping_status: 'unmapped' },
            variant: { is_active: true, is_deleted: false, sku: 'TEST-CATALOG-SKU' },
          },
        ],
      },
    }),
  );

  assert.equal(readiness.ready, true);
  assert.equal(readiness.itemReviewStatus, 'ready');
  assert.ok(!readiness.blockers.some((blocker) => blocker.category === 'items'));
});

test('does not require artwork when every direct product explicitly opts out', () => {
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
        data: [
          {
            product: {
              is_active: true,
              is_deleted: false,
              mapping_status: 'mapped',
              no_need_artworks: true,
            },
            variant: { is_active: true, is_deleted: false },
          },
        ],
      },
    }),
  );

  assert.equal(readiness.ready, true);
  assert.equal(readiness.artworkReviewStatus, 'not_required');
  assert.ok(!readiness.blockers.some((blocker) => blocker.category === 'artwork'));
});

test('does not infer missing production artwork for a resolved catalog-backed item', () => {
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
        data: [
          {
            ffm_map_item_status: 'pending',
            catalogInfo: { sku: 'TEST-CATALOG-SKU' },
            product: {
              is_active: false,
              is_deleted: true,
              mapping_status: 'unmapped',
              no_need_artworks: false,
            },
            variant: { is_active: true, is_deleted: false, sku: 'TEST-CATALOG-SKU' },
          },
        ],
      },
    }),
  );

  assert.equal(readiness.ready, true);
  assert.equal(readiness.artworkReviewStatus, 'catalog_managed');
  assert.ok(!readiness.blockers.some((blocker) => blocker.category === 'artwork'));
});

test('treats the observed numeric zero invoice as a non-blocking pre-push placeholder', () => {
  const readiness = classifyMerchizeProductionReadiness(
    readyPayloads({
      fulfillmentInvoice: {
        success: true,
        data: [
          {
            code: 'RX-TEST',
            external_number: 'ORD-TEST',
            identifier: 'codexchristi-shop',
            fulfillment_cost: 0,
          },
        ],
      },
    }),
  );

  assert.equal(readiness.status, 'ready');
  assert.equal(readiness.ready, true);
  assert.equal(readiness.costReviewStatus, 'awaiting_fulfillment');
  assert.ok(!readiness.blockers.some((blocker) => blocker.category === 'cost'));
});

test('treats successful invoice data without a cost object as awaiting fulfillment', () => {
  const readiness = classifyMerchizeProductionReadiness(
    readyPayloads({
      fulfillmentInvoice: {
        success: true,
        data: [
          {
            code: 'RX-TEST',
            external_number: 'ORD-TEST',
            identifier: 'codexchristi-shop',
            fulfillment_cost: null,
          },
        ],
      },
    }),
  );

  assert.equal(readiness.status, 'ready');
  assert.equal(readiness.costReviewStatus, 'awaiting_fulfillment');
  assert.equal(readiness.primaryBlocker, null);
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

import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { applyMerchizeFulfillmentAddressCorrection } from './applyMerchizeFulfillmentAddressCorrection';
import { runPaidFulfillmentProcessing } from '@/lib/paypal/txLedger/runPaidFulfillmentProcessing';
import { CUSTOMER_ADDRESS_CORRECTION_ACTOR, CUSTOMER_ADDRESS_CORRECTION_REQUESTED, CUSTOMER_ADDRESS_CORRECTION_REVIEW } from '@/lib/shop/checkout/customerAddressCorrection';

const original = {
  address: '1 Example Street', address2: '', city: 'Example City', state: 'CA',
  postal_code: '90001', country_code: 'US',
};
const corrected = { ...original, address: '2 Example Street', address2: 'Unit 3' };
const identity = {
  id: 'ops-fixture', merchizeOrderId: 'merchize-fixture', merchizeExternalOrderNumber: 'ORD-fixture',
  merchizeIdentifier: 'fixture', djangoPaymentSaveCustomId: 'django-fixture',
};

function setup(t: TestContext, {
  readbackMatches = true, buyerAddress = original, status = 'unfulfilled', priorPush = false,
  validationStatus = 'street_undefined', send = { pushed: false } as { pushed?: boolean },
} = {}) {
  const beforeOps = global.__merchizeFulfillmentOpsPrisma__;
  t.after(() => { global.__merchizeFulfillmentOpsPrisma__ = beforeOps; });
  for (const [key, value] of Object.entries({
    SHOP_OPS_DATA_TARGET: 'dev',
    PAYPAL_TX_LEDGER_NEON_BRANCH: 'dev',
    MERCHIZE_FULFILLMENT_OPS_NEON_BRANCH: 'dev',
    PAYPAL_TX_LEDGER_NEON_POOLED_DB_DEV_STRING: 'postgresql://fixture:fixture@localhost:1/unused',
    MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_DEV_STRING: 'postgresql://fixture:fixture@localhost:1/unused',
    MERCHIZE_BO_API_BASE_URL: 'https://merchize.example/bo-api', MERCHIZE_API_KEY: 'fixture-key',
  })) {
    const before = process.env[key];
    process.env[key] = value;
    t.after(() => { if (before === undefined) delete process.env[key]; else process.env[key] = before; });
  }
  const opsUpdates: Array<Record<string, unknown>> = [];
  const db = {
    $transaction: (transaction: (tx: unknown) => Promise<unknown>) => transaction(db),
    merchizeFulfillmentOrder: {
      findMany: async () => [identity],
      update: async ({ data }: { data: Record<string, unknown> }) => opsUpdates.push(data),
    },
    merchizeFulfillmentSyncAttempt: {
      findFirst: async () => priorPush ? { id: 'earlier-push' } : null,
      create: async () => ({ id: 'attempt-fixture' }), update: async () => ({}),
    },
  };
  global.__merchizeFulfillmentOpsPrisma__ = db as unknown as NonNullable<typeof beforeOps>;
  const writes: Array<Record<string, unknown>> = [];
  const fetchMock = t.mock.method(globalThis, 'fetch', async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'merchize.example');
    assert.doesNotMatch(url.pathname, /push|mark-valid-address/u);
    const endpoint = url.pathname.split('/').at(-1);
    if (endpoint === 'order-detail') return Response.json({ success: true, data: {
      _id: identity.merchizeOrderId, external_number: identity.merchizeExternalOrderNumber,
      identifier: identity.merchizeIdentifier, order_status: status,
    } });
    if (endpoint === 'merchize-fixture') return Response.json({ success: true, data: {
      validate_shipping_address: validationStatus, push_to_fulfillment_progress: 'validating',
    } });
    if (endpoint === 'send-to-fulfillment-date') return Response.json({ success: true, data: send });
    if (endpoint === 'require-attention') return Response.json({ success: true, data: [] });
    if (endpoint === 'buyerdetails') {
      if (init?.method === 'POST') {
        writes.push(JSON.parse(String(init.body)));
        return Response.json({ success: true });
      }
      return Response.json({ success: true, data: { shipping_address: {
        ...(writes.length && readbackMatches ? corrected : buyerAddress),
        email: 'fixture@example.test', full_name: 'Fixture Buyer',
      } } });
    }
    throw new Error(`Unexpected fixture endpoint: ${endpoint}`);
  });
  const apply = () => applyMerchizeFulfillmentAddressCorrection({
    orderToken: 'fixture-address-correction', customerName: 'Fixture Buyer',
    address: { line1: corrected.address, line2: corrected.address2, city: corrected.city,
      state: corrected.state, postalCode: corrected.postal_code, country: corrected.country_code },
    buyerRequest: { externalNumber: identity.merchizeExternalOrderNumber,
      djangoPaymentSaveCustomId: identity.djangoPaymentSaveCustomId, originalAddress: original,
      assertProcessingLease: async () => {}, },
  });
  return { apply, fetchMock, writes, opsUpdates };
}

test('saves only the buyer address and records pending postal validation after exact read-back', async (t) => {
  const fixture = setup(t);
  assert.equal((await fixture.apply()).ok, true);
  assert.equal(fixture.writes.length, 1);
  assert.equal(fixture.writes[0]?.address, corrected.address);
  assert.equal(fixture.writes[0]?.address2, corrected.address2);
  assert.equal(fixture.writes[0]?.email, 'fixture@example.test');
  assert.equal(fixture.opsUpdates[0]?.addressReviewStatus, 'provider_update_pending_validation');
});

test('a retry that reads back the saved correction does not post it again', async (t) => {
  const fixture = setup(t, { buyerAddress: corrected, validationStatus: 'valid' });
  assert.equal((await fixture.apply()).ok, true);
  assert.equal(fixture.writes.length, 0);
});

test('a successful POST without exact read-back never verifies the correction', async (t) => {
  const fixture = setup(t, { readbackMatches: false });
  assert.equal((await fixture.apply()).ok, false);
  assert.equal(fixture.writes.length, 1);
  assert.equal(fixture.opsUpdates[0]?.addressReviewStatus, 'provider_update_failed');
});

for (const [name, options] of [
  ['the order is on hold', { status: 'on_hold' }],
  ['a push was already attempted', { priorPush: true }],
  ['release cannot be ruled out', { send: {} }],
  ['the original provider address changed', { buyerAddress: { ...original, address2: 'Unexpected unit' } }],
  ['the initial address flag is gone', { validationStatus: 'valid' }],
] as const) {
  test(`does not change the buyer address when ${name}`, async (t) => {
    const fixture = setup(t, options);
    assert.equal((await fixture.apply()).ok, false);
    assert.equal(fixture.writes.length, 0);
  });
}

test('the recovery worker applies a queued correction without replaying payment, import, receipt, or push', async (t) => {
  const fixture = setup(t);
  const ledger = global.__paypalTxLedger__;
  t.after(() => { global.__paypalTxLedger__ = ledger; });
  const snapshot = (address: typeof original) => ({
    shipping_address_line_1: address.address, shipping_address_line_2: address.address2,
    shipping_city: address.city, shipping_state: address.state, zip_code: address.postal_code,
    shipping_country: address.country_code,
  });
  const amount = { value: '40.00', currencyCode: 'USD' };
  const row = {
    orderToken: 'fixture-address-correction', status: 'payment_saved', lastErrorCode: CUSTOMER_ADDRESS_CORRECTION_REQUESTED,
    capturePayload: { id: 'fixture-capture', status: 'COMPLETED', amount },
    authorizePayload: { purchaseUnits: [{ amount }] },
    canonicalOrderSnapshot: null, canonicalOrderSnapshotVersion: null, canonicalOrderSnapshotHash: null,
    receiptLink: 'receipt', receiptFile: 'receipt.pdf', djangoPaymentSaveCustomId: identity.djangoPaymentSaveCustomId,
    processingCompletedAt: null, postProcessingLockId: null,
    shippingSnapshot: snapshot(original), fulfillmentAddressOverride: snapshot(corrected),
    fulfillmentAddressOverriddenBy: CUSTOMER_ADDRESS_CORRECTION_ACTOR,
    merchizeFulfillmentResponsePayload: { status: 201, success: true, data: {
      processing_status: 'completed', response_data: { data: { order_id: identity.merchizeExternalOrderNumber } },
    } },
  };
  global.__paypalTxLedger__ = {
    paypalIntent: {
      findUnique: async ({ select }: { select?: unknown }) => select ? null : structuredClone(row),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (where.postProcessingLockId && where.postProcessingLockId !== row.postProcessingLockId) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    paidOrderRecoveryProjection: { delete: async () => ({}) },
  } as unknown as NonNullable<typeof ledger>;
  await runPaidFulfillmentProcessing(row.orderToken);
  assert.equal(fixture.writes.length, 1);
  assert.equal(row.lastErrorCode, 'MERCHIZE_ADDRESS_VALIDATION_PENDING');
  assert.equal(row.status, 'payment_saved');
  assert.equal(row.processingCompletedAt, null);
  assert.equal(row.receiptLink, 'receipt');
  assert.equal(row.djangoPaymentSaveCustomId, identity.djangoPaymentSaveCustomId);
  assert.deepEqual(row.shippingSnapshot, snapshot(original));

  row.status = 'fulfillment_attention_required';
  row.lastErrorCode = CUSTOMER_ADDRESS_CORRECTION_REVIEW;
  const reads = fixture.fetchMock.mock.callCount();
  await runPaidFulfillmentProcessing(row.orderToken);
  assert.equal(fixture.fetchMock.mock.callCount(), reads, 'review cannot be bypassed by running recovery again');
});

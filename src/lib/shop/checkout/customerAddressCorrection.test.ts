import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { createRequestStoreForAPI } from 'next/dist/server/async-storage/request-store';
import { workAsyncStorage, type WorkStore } from 'next/dist/server/app-render/work-async-storage.external';
import { workUnitAsyncStorage } from 'next/dist/server/app-render/work-unit-async-storage.external';
import type { PrismaClient } from '@/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client';
import { POST } from '@/app/api/shop/checkout/[orderToken]/correct-address/route';
import { buildShopAddressCorrectionEmail } from '@/lib/shop/email/templates';
import { checkoutGrantCookieName, createCheckoutGrant } from './checkoutProof';
import { customerUsAddressCorrectionSchema, getBuyerAddressCorrectionSetup } from './customerAddressCorrectionServer';
import {
  classifyBuyerCorrectionFlag,
  CUSTOMER_ADDRESS_CORRECTION_ACTOR,
  CUSTOMER_ADDRESS_CORRECTION_REQUESTED,
  CUSTOMER_ADDRESS_CORRECTION_REVIEW,
} from './customerAddressCorrection';

const correction = {
  line1: '10 Example Lane', line2: 'Unit 2', city: 'Example City',
  state: 'California', postalCode: '90001-1234', confirmed: true,
};

function order() {
  const amount = { value: '40.00', currencyCode: 'USD' };
  return {
    orderToken: 'fixture-address-correction', userId: null, status: 'fulfillment_attention_required',
    lastErrorCode: 'MERCHIZE_ADDRESS_INVALID', updatedAt: new Date(),
    canonicalOrderSnapshot: null, canonicalOrderSnapshotVersion: null, canonicalOrderSnapshotHash: null,
    authorizePayload: { purchaseUnits: [{ amount }] },
    capturePayload: { id: 'fixture-capture', status: 'COMPLETED', amount },
    processingCompletedAt: null as Date | null,
    fulfillmentAddressOverride: null, fulfillmentAddressOverriddenBy: null as string | null,
    fulfillmentAddressOverriddenAt: null as Date | null,
    shippingSnapshot: {
      shipping_address_line_1: '1 Example Lane', shipping_city: 'Example City', shipping_state: 'CA',
      zip_code: '90001', shipping_country: 'US',
    },
    djangoPaymentSaveCustomId: 'fixture-payment', receiptLink: 'fixture-receipt', receiptFile: 'fixture.pdf',
    merchizeFulfillmentResponsePayload: {
      status: 201, success: true,
      data: {
        processing_status: 'completed', error_message: 'Order created but details not available',
        response_data: { data: { order_id: 'ORD-FIXTURE', _id: 'not-an-actionable-provider-id' } },
      },
    },
  };
}

test('only a confirmed U.S. address problem on a safely paid and imported order offers correction', () => {
  const row = order();
  assert.deepEqual(getBuyerAddressCorrectionSetup(row), { state: 'required', externalNumber: 'ORD-FIXTURE' });
  const evaluate = (patch: Partial<ReturnType<typeof order>>) => getBuyerAddressCorrectionSetup({ ...row, ...patch });
  assert.equal(evaluate({ lastErrorCode: 'MERCHIZE_ADDRESS_VALIDATION_PENDING', status: 'payment_saved' }), null);
  assert.equal(evaluate({ lastErrorCode: 'MERCHIZE_PROVIDER_ADDRESS_MISMATCH' }), null);
  assert.equal(evaluate({ status: 'refunded' }), null);
  assert.equal(evaluate({ processingCompletedAt: new Date() }), null);
  assert.equal(evaluate({ capturePayload: { ...row.capturePayload, status: 'PENDING' } }), null);
  assert.equal(evaluate({ shippingSnapshot: { ...row.shippingSnapshot, shipping_country: 'CA' } }), null);
  assert.equal(evaluate({ lastErrorCode: CUSTOMER_ADDRESS_CORRECTION_REVIEW })?.state, 'review');
  assert.equal(evaluate({ lastErrorCode: CUSTOMER_ADDRESS_CORRECTION_REQUESTED, status: 'payment_saved' })?.state, 'checking');
});

test('validates the selected state and ZIP and does not accept a country, email, or missing confirmation', () => {
  assert.equal(customerUsAddressCorrectionSchema.parse(correction).state, 'CA');
  for (const patch of [
    { country: 'CA' }, { email: 'buyer@example.test' }, { state: 'ON' },
    { postalCode: '000' }, { confirmed: false }, { line1: 'One\nTwo' },
  ]) assert.equal(customerUsAddressCorrectionSchema.safeParse({ ...correction, ...patch }).success, false);
});

test('the verified buyer can queue one correction without any provider request or payment grant', async (t) => {
  const previous = global.__paypalTxLedger__;
  t.after(() => { global.__paypalTxLedger__ = previous; });
  for (const [key, value] of Object.entries({
    NODE_ENV: 'development', SESSION_SECRET: 'fixture-checkout-address-secret-of-at-least-32-bytes',
    SHOP_OPS_DATA_TARGET: 'dev', PAYPAL_TX_LEDGER_NEON_BRANCH: 'dev', MERCHIZE_FULFILLMENT_OPS_NEON_BRANCH: 'dev',
    PAYPAL_TX_LEDGER_NEON_POOLED_DB_DEV_STRING: 'postgresql://fixture:fixture@localhost:1/unused',
    MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_DEV_STRING: 'postgresql://fixture:fixture@localhost:1/unused',
    PAYPAL_TX_LEDGER_RECOVERY_SCANNER_ENABLED: 'true',
  })) {
    const before = process.env[key];
    process.env[key] = value;
    t.after(() => { if (before === undefined) delete process.env[key]; else process.env[key] = before; });
  }
  const row = order();
  const network = t.mock.method(globalThis, 'fetch', () => assert.fail('The correction route must not use the network'));
  let saved = 0;
  global.__paypalTxLedger__ = {
    paypalIntent: {
      findUnique: async ({ select }: { select?: unknown }) => select ? null : structuredClone(row),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        assert.equal(where.lastErrorCode, 'MERCHIZE_ADDRESS_INVALID');
        assert.equal(where.fulfillmentAddressOverriddenAt, null);
        assert.equal(where.processingCompletedAt, null);
        assert.deepEqual(where.updatedAt, row.updatedAt);
        assert.equal(data.fulfillmentAddressOverriddenBy, CUSTOMER_ADDRESS_CORRECTION_ACTOR);
        assert.equal(data.lastErrorCode, CUSTOMER_ADDRESS_CORRECTION_REQUESTED);
        assert.equal(data.status, 'payment_saved');
        assert.equal(data.capturePayload, undefined);
        assert.equal(data.shippingSnapshot, undefined);
        if (saved) return { count: 0 };
        saved++;
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    paidOrderRecoveryProjection: { delete: async () => ({}) },
  } as unknown as PrismaClient;
  const verified = `${checkoutGrantCookieName(row.orderToken)}=${createCheckoutGrant(row, 'status')}`;
  const submit = (cookie: string, origin = 'http://localhost:3001', body: unknown = correction) => {
    const request = new NextRequest(`http://localhost:3001/api/shop/checkout/${row.orderToken}/correct-address`, {
      method: 'POST', headers: { host: 'localhost:3001', origin, cookie, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const store = createRequestStoreForAPI(request, request.nextUrl, { tags: [], expirationsByCacheKind: new Map() }, undefined, undefined, undefined);
    return workAsyncStorage.run({ route: '/test' } as WorkStore, () =>
      workUnitAsyncStorage.run(store, () => POST(request, { params: Promise.resolve({ orderToken: row.orderToken }) })),
    );
  };
  assert.equal((await submit('')).status, 403);
  assert.equal((await submit(verified, 'https://elsewhere.example')).status, 403);
  process.env.PAYPAL_TX_LEDGER_RECOVERY_SCANNER_ENABLED = 'false';
  assert.equal((await submit(verified)).status, 503);
  process.env.PAYPAL_TX_LEDGER_RECOVERY_SCANNER_ENABLED = 'true';
  assert.equal((await submit(verified, undefined, { ...correction, push: true })).status, 400);
  const responses = await Promise.all([submit(verified), submit(verified)]);
  assert.deepEqual(responses.map(({ status }) => status).sort(), [202, 409]);
  const accepted = responses.find(({ status }) => status === 202)!;
  assert.deepEqual(await accepted.json(), { state: 'checking' });
  assert.equal(accepted.headers.get('cache-control'), 'private, no-store');
  assert.equal(accepted.headers.get('set-cookie'), null);
  assert.equal((await submit(verified)).status, 200);
  assert.equal(saved, 1);
  assert.equal(network.mock.callCount(), 0);
});

test('a still-flagged correction gets a bounded wait, then requires master-admin review', () => {
  const update = new Date('2026-11-23T18:00:00Z');
  const code = 'MERCHIZE_ADDRESS_INVALID';
  const pending = {
    actor: CUSTOMER_ADDRESS_CORRECTION_ACTOR, primaryCode: code, readback: 'matched',
    blockers: [{ code, retryable: false }], providerAddressUpdatedAt: update, now: update,
  };
  assert.equal(classifyBuyerCorrectionFlag(pending), 'waiting');
  assert.equal(classifyBuyerCorrectionFlag({ ...pending, now: new Date(update.getTime() + 300_000) }), 'review');
  assert.equal(classifyBuyerCorrectionFlag({ ...pending, readback: 'mismatch' }), 'review');
  assert.equal(classifyBuyerCorrectionFlag({ ...pending, actor: null }), null);
  assert.equal(classifyBuyerCorrectionFlag({ ...pending, primaryCode: 'MERCHIZE_ADDRESS_VALIDATION_PENDING' }), null);
});

test('the branded notice links to verification and contains no address or second-payment instructions', () => {
  const email = buildShopAddressCorrectionEmail('fixture-address-correction');
  assert.match(email.htmlbody, /Codex Christi Shop/u);
  assert.match(email.htmlbody, /confirmation\/fixture-address-correction\?view=details/u);
  assert.match(email.htmlbody, /verify access/u);
  assert.match(email.htmlbody, /do not need to pay again/u);
  assert.doesNotMatch(email.htmlbody, /10 Example Lane|buyer@example\.test/u);
});

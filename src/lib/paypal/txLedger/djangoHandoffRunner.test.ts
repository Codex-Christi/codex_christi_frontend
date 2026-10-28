import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client';
import { runPaidFulfillmentProcessing } from './runPaidFulfillmentProcessing';

test('all real runner entry points hold lost Django replies/checkpoints without replay or recapture', async (t) => {
  const previous = { ...process.env };
  const clients = {
    paypal: global.__paypalTxLedger__,
    merchize: global.__merchizeFulfillmentOpsPrisma__,
    admin: global.__adminOpsLedgerPrisma__,
  };
  Object.assign(process.env, {
    SHOP_OPS_DATA_TARGET: 'dev',
    PAYPAL_TX_LEDGER_NEON_POOLED_DB_DEV_STRING: 'postgresql://fixture:fixture@localhost:1/unused',
    MERCHIZE_FULFILLMENT_OPS_NEON_POOLED_DB_DEV_STRING:
      'postgresql://fixture:fixture@localhost:1/unused',
    NEXT_PUBLIC_DJANGO_API_BASE_URL: 'https://django.example/api/v1',
    DJANGO_INTERNAL_BASE_URL: 'https://django.example/api/v1',
    SHOP_CHECKOUT_SERVER_ACTIONS_POST_PROCESSING_CRYPTO_SECRET: 'handoff-runner-test-secret',
    SHOP_CHECKOUT_OTP_VERIFICATION_API_KEY: 'handoff-runner-signature-secret',
    ORDER_RECOVERY_ADMIN_EMAILS: '',
  });
  t.after(() => {
    global.__paypalTxLedger__ = clients.paypal;
    global.__merchizeFulfillmentOpsPrisma__ = clients.merchize;
    global.__adminOpsLedgerPrisma__ = clients.admin;
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  });
  global.__merchizeFulfillmentOpsPrisma__ = {
    merchizeFulfillmentOrder: { findFirst: async () => null },
  } as unknown as NonNullable<typeof global.__merchizeFulfillmentOpsPrisma__>;
  global.__adminOpsLedgerPrisma__ = {
    adminNotificationRecipientGroup: { findUnique: async () => ({ enabled: false }) },
  } as unknown as NonNullable<typeof global.__adminOpsLedgerPrisma__>;

  for (const operation of ['payment_save', 'fulfillment_handoff'] as const) {
    for (const failureMode of [
      'lost_reply',
      'lost_checkpoint',
      'wrong_identity',
      'duplicate_conflict',
    ] as const) {
      let calls = 0;
      let failCheckpoint = failureMode === 'lost_checkpoint';
      const row: Record<string, unknown> = {
        id: 'row-1',
        orderToken: 'token-1',
        userId: null,
        djangoOrderIntentUuid: 'intent-1',
        djangoOrderIntentOrderId: 'ORD-1',
        customerName: 'Test Customer',
        customerEmail: 'customer@example.test',
        countryIso2: 'US',
        countryIso3: 'USA',
        initialCurrency: 'USD',
        status: 'receipt_uploaded',
        createdAt: new Date(),
        updatedAt: new Date(),
        receiptLink: 'https://payment-receipts.codexchristi.shop/paypal/fixture.pdf',
        receiptFile: 'fixture',
        canonicalOrderSnapshot: null,
        canonicalOrderSnapshotVersion: null,
        canonicalOrderSnapshotHash: null,
        authorizePayload: {
          id: 'PAYPAL-1',
          purchaseUnits: [{ customId: 'token-1', amount: { value: '35.00', currencyCode: 'USD' } }],
        },
        capturePayload: {
          id: 'PAYPAL-1',
          purchaseUnits: [
            {
              payments: {
                captures: [
                  {
                    id: 'CAPTURE-1',
                    status: 'COMPLETED',
                    amount: { value: '35.00', currencyCode: 'USD' },
                  },
                ],
              },
            },
          ],
        },
        shippingSnapshot: {
          shipping_address_line_1: '1 Test Street',
          shipping_city: 'Test City',
          shipping_state: 'CA',
          zip_code: '90001',
          shipping_country: 'USA',
        },
        cartSnapshot: [
          {
            variantId: 'variant-1',
            quantity: 1,
            itemDetail: {
              product: 'product-1',
              sku: 'sku-1',
              sku_seller: 'seller-1',
              retail_price: 35,
              image: 'https://mainmedia.codexchristi.org/media/test.jpg',
            },
          },
        ],
        djangoPaymentSaveCustomId: operation === 'payment_save' ? null : 'payment-1',
        djangoPaymentSaveResponsePayload: null,
        merchizeFulfillmentResponsePayload: null,
        merchizeFulfillmentRequestPayload: null,
        merchizeFulfillmentProcessingId: null,
        merchizeProviderOrderId: null,
        merchizeProviderOrderCode: null,
        processingCompletedAt: null,
        postProcessingLockId: null,
        postProcessingLockExpiresAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      };
      const projections: Array<Record<string, unknown>> = [];
      const client = {
        paypalIntent: {
          findUnique: async () => structuredClone(row),
          updateMany: async ({
            where,
            data,
          }: {
            where: Record<string, unknown>;
            data: Record<string, unknown>;
          }) => {
            if (
              where.postProcessingLockId !== undefined &&
              where.postProcessingLockId !== row.postProcessingLockId
            )
              return { count: 0 };
            const checkpoint =
              operation === 'payment_save'
                ? data.djangoPaymentSaveCustomId
                : data.merchizeFulfillmentProcessingId;
            if (failCheckpoint && checkpoint) {
              failCheckpoint = false;
              throw new Error('Fixture checkpoint write failed after Django succeeded');
            }
            const values = Object.fromEntries(
              Object.entries(data).filter(([, value]) => value !== undefined),
            );
            Object.assign(row, structuredClone(values), { updatedAt: new Date() });
            return { count: 1 };
          },
        },
        paypalWebhookEvent: { findFirst: async () => null },
        paidOrderRecoveryProjection: {
          upsert: async ({ create }: { create: Record<string, unknown> }) => {
            projections.push(create);
          },
        },
        adminNotificationOutbox: {
          findMany: async () => [],
          createMany: async () => ({ count: 0 }),
        },
        $transaction: async (run: (db: unknown) => Promise<unknown>) => run(client),
      };
      global.__paypalTxLedger__ = client as unknown as PrismaClient;
      const network = t.mock.method(globalThis, 'fetch', async (url: RequestInfo | URL) => {
        calls++;
        assert.equal(
          String(url),
          operation === 'payment_save'
            ? 'https://django.example/api/v1/orders/order-payment'
            : 'https://django.example/api/v1/orders/process/payment-1',
        );
        if (failureMode === 'lost_reply')
          throw new Error('Fixture connection lost after Django committed');
        if (failureMode === 'duplicate_conflict')
          return Response.json({ message: 'Payment/order already exists' }, { status: 409 });
        return Response.json(
          {
            status: 201,
            success: true,
            data: {
              id: 'd73b4b97-3ec0-4163-8a34-55d649404f81',
              custom_id: 'payment-1',
              recipient_email: 'customer@example.test',
              user: null,
              order_intent_id: failureMode === 'wrong_identity' ? 'another-intent' : 'intent-1',
              order_intent_order_id: 'ORD-1',
              captured_order_paypal_id: 'PAYPAL-1',
              order_payment_custom_id: 'payment-1',
              processing_status: 'completed',
              error_message: null,
            },
          },
          { status: 201 },
        );
      });
      await runPaidFulfillmentProcessing('token-1', { triggerSource: 'capture_route' }).catch(
        () => {},
      );
      assert.equal(calls, 1, 'Only the intended Django operation was dispatched');
      const evidence = row[
        operation === 'payment_save'
          ? 'djangoPaymentSaveResponsePayload'
          : 'merchizeFulfillmentResponsePayload'
      ] as { _nextDjangoAttempt: { outcome: string; code?: string; httpStatus?: number } };
      assert.equal(
        evidence._nextDjangoAttempt.outcome,
        failureMode === 'lost_checkpoint' ? 'started' : 'uncertain',
      );
      if (failureMode === 'wrong_identity')
        assert.match(evidence._nextDjangoAttempt.code ?? '', /^INVALID_DJANGO_/u);
      if (failureMode === 'duplicate_conflict')
        assert.equal(evidence._nextDjangoAttempt.httpStatus, 409);
      assert.equal(
        row.djangoPaymentSaveCustomId,
        operation === 'payment_save' ? null : 'payment-1',
      );
      for (const triggerSource of [
        'capture_route',
        'webhook',
        'manual_admin',
        'recovery_scanner',
        'payment_reconciliation',
      ] as const) {
        await runPaidFulfillmentProcessing('token-1', { triggerSource });
      }
      await runPaidFulfillmentProcessing('token-1', {
        executionScope: 'merchize_fulfillment_only',
      });
      assert.equal(
        calls,
        1,
        'No entry point may repeat the POST, recapture or invoke supplier operations',
      );
      assert.equal(row.status, 'fulfillment_attention_required');
      assert.match(String(row.lastErrorCode), /REVIEW_REQUIRED$/u);
      assert.equal(projections.at(-1)?.canRetryFullPostProcessing, false);
      assert.equal(projections.at(-1)?.canRetryFulfillment, false);
      network.mock.restore();
    }
  }
});

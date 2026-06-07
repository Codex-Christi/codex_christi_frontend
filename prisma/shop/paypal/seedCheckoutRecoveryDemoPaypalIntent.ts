import path from 'node:path';
import { randomUUID } from 'node:crypto';
import * as dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../src/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const DEMO_TOKEN_PREFIX = 'demo-recovery-';
const DEMO_CURRENCY = 'USD';
const DEMO_ITEM_TOTAL = 102.96;
const DEMO_SHIPPING_TOTAL = 8.99;
const DEMO_PAID_TOTAL = DEMO_ITEM_TOTAL + DEMO_SHIPPING_TOTAL;

function getPaypalLedgerConnectionString() {
  const target = process.env.PAYPAL_TX_LEDGER_NEON_BRANCH ?? 'dev';
  const prodUrl = process.env.PAYPAL_TX_LEDGER_NEON_POOLED_DB_STRING;
  const devUrl = process.env.PAYPAL_TX_LEDGER_NEON_POOLED_DB_DEV_STRING;

  if (target === 'prod') {
    if (!prodUrl) throw new Error('Missing PAYPAL_TX_LEDGER_NEON_POOLED_DB_STRING');
    return prodUrl;
  }

  if (!devUrl) throw new Error('Missing PAYPAL_TX_LEDGER_NEON_POOLED_DB_DEV_STRING');
  return devUrl;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function demoMoney(value: number) {
  return {
    currencyCode: DEMO_CURRENCY,
    value: value.toFixed(2),
  };
}

const paypalTxLedger = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: getPaypalLedgerConnectionString(),
  }),
});

async function createDemoIntent(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const orderToken = `${DEMO_TOKEN_PREFIX}${randomUUID()}`;
  const djangoOrderIntentUuid = `${DEMO_TOKEN_PREFIX}django-intent-${randomUUID()}`;
  const djangoOrderIntentOrderId = `${DEMO_TOKEN_PREFIX}django-intent-order-${randomUUID()}`;
  const djangoPaymentSaveCustomId = `${DEMO_TOKEN_PREFIX}django-payment-save-${randomUUID()}`;
  const shippingSnapshot = {
    shipping_address_line_1: '123 Demo Recovery Street',
    shipping_address_line_2: '',
    shipping_city: 'Los Angeles',
    shipping_state: 'CA',
    shipping_country: 'USA',
    zip_code: '90001',
  };
  const cartSnapshot = [
    {
      variantId: 'demo-variant-hoodie-001',
      quantity: 1,
      title: 'Codex Christi Embroidered Hoodie',
      slug: 'codex-christi-embroidered-hoodie',
      itemDetail: {
        _id: 'demo-item-detail-hoodie-001',
        image_uris: ['https://codexchristi.org/media/img/general/logo-glow-tiny.jpg'],
        retail_price: 44.99,
        is_default: true,
        sku: 'DEMO-MERCHIZE-HOODIE',
        sku_seller: 'DEMO-SELLER-HOODIE',
        title: 'Codex Christi Embroidered Hoodie',
        options: [],
        image: 'https://codexchristi.org/media/img/general/logo-glow-tiny.jpg',
      },
    },
    {
      variantId: 'demo-variant-journal-001',
      quantity: 2,
      title: 'Scripture Study Journal',
      slug: 'scripture-study-journal',
      itemDetail: {
        _id: 'demo-item-detail-journal-001',
        image_uris: ['https://codexchristi.org/media/img/general/logo-glow-tiny.jpg'],
        retail_price: 16.49,
        is_default: true,
        sku: 'DEMO-MERCHIZE-JOURNAL',
        sku_seller: 'DEMO-SELLER-JOURNAL',
        title: 'Scripture Study Journal',
        options: [],
        image: 'https://codexchristi.org/media/img/general/logo-glow-tiny.jpg',
      },
    },
    {
      variantId: 'demo-variant-cap-001',
      quantity: 1,
      title: 'Crown Logo Dad Cap',
      slug: 'crown-logo-dad-cap',
      itemDetail: {
        _id: 'demo-item-detail-cap-001',
        image_uris: ['https://codexchristi.org/media/img/general/logo-glow-tiny.jpg'],
        retail_price: 24.99,
        is_default: true,
        sku: 'DEMO-MERCHIZE-CAP',
        sku_seller: 'DEMO-SELLER-CAP',
        title: 'Crown Logo Dad Cap',
        options: [],
        image: 'https://codexchristi.org/media/img/general/logo-glow-tiny.jpg',
      },
    },
  ];

  const row = await paypalTxLedger.paypalIntent.create({
    data: {
      orderToken,
      paypalOrderId: `${DEMO_TOKEN_PREFIX}paypal-${randomUUID()}`,
      paypalAuthorizationId: `${DEMO_TOKEN_PREFIX}auth-${randomUUID()}`,
      customerName: 'Recovery Demo Customer',
      customerEmail: normalizedEmail,
      countryIso2: 'US',
      countryIso3: 'USA',
      initialCurrency: 'USD',
      cartSnapshot,
      shippingSnapshot,
      capturePayload: {
        id: `${DEMO_TOKEN_PREFIX}capture-${randomUUID()}`,
        status: 'COMPLETED',
        amount: demoMoney(DEMO_PAID_TOTAL),
        finalCapture: true,
        sellerReceivableBreakdown: {
          grossAmount: demoMoney(DEMO_PAID_TOTAL),
          paypalFee: demoMoney(3.56),
          netAmount: demoMoney(DEMO_PAID_TOTAL - 3.56),
        },
        purchaseUnits: [
          {
            amount: {
              ...demoMoney(DEMO_PAID_TOTAL),
              breakdown: {
                itemTotal: demoMoney(DEMO_ITEM_TOTAL),
                shipping: demoMoney(DEMO_SHIPPING_TOTAL),
              },
            },
            payments: {
              captures: [
                {
                  id: `${DEMO_TOKEN_PREFIX}nested-capture-${randomUUID()}`,
                  status: 'COMPLETED',
                  amount: demoMoney(DEMO_PAID_TOTAL),
                },
              ],
            },
          },
        ],
        demo: true,
      },
      djangoOrderIntentUuid,
      djangoOrderIntentOrderId,
      djangoOrderIntentPayload: {
        status: 201,
        success: true,
        message: 'Demo Django order intent created for checkout recovery testing.',
        data: {
          id: djangoOrderIntentUuid,
          email: normalizedEmail,
          address: shippingSnapshot.shipping_address_line_1,
          address_2: shippingSnapshot.shipping_address_line_2,
          city: shippingSnapshot.shipping_city,
          state: shippingSnapshot.shipping_state,
          zip_code: shippingSnapshot.zip_code,
          country: shippingSnapshot.shipping_country,
          otp_status: 'pending',
          order_id: djangoOrderIntentOrderId,
          has_pending_otp: true,
        },
      },
      djangoOrderIntentVerifyPayload: {
        status: 200,
        success: true,
        message: 'Demo Django order intent OTP verified for checkout recovery testing.',
        data: {
          id: djangoOrderIntentUuid,
          email: normalizedEmail,
          address: shippingSnapshot.shipping_address_line_1,
          address_2: shippingSnapshot.shipping_address_line_2,
          city: shippingSnapshot.shipping_city,
          state: shippingSnapshot.shipping_state,
          zip_code: shippingSnapshot.zip_code,
          country: shippingSnapshot.shipping_country,
          otp_status: 'verified',
          order_id: djangoOrderIntentOrderId,
          has_pending_otp: false,
        },
      },
      djangoPaymentSaveCustomId,
      status: 'payment_saved',
      lastEventType: 'PAYMENT.CAPTURE.COMPLETED',
      lastErrorCode: 'POST_PROCESSING_FAILED',
      lastErrorMessage: 'Demo fulfillment push paused for checkout recovery testing.',
    },
  });

  console.log('[recovery-demo.create]', {
    email: row.customerEmail,
    orderToken: row.orderToken,
    status: row.status,
    paidAmount: `${DEMO_CURRENCY} ${DEMO_PAID_TOTAL.toFixed(2)}`,
    cartLineCount: cartSnapshot.length,
    matchesRecoveryLookup: true,
  });
}

async function listDemoIntents(email: string) {
  const normalizedEmail = normalizeEmail(email);

  const rows = await paypalTxLedger.paypalIntent.findMany({
    where: {
      customerEmail: normalizedEmail,
      orderToken: {
        startsWith: DEMO_TOKEN_PREFIX,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      orderToken: true,
      customerEmail: true,
      status: true,
      capturePayload: true,
      cartSnapshot: true,
      shippingSnapshot: true,
      djangoOrderIntentOrderId: true,
      djangoOrderIntentVerifyPayload: true,
      processingCompletedAt: true,
      lastErrorCode: true,
      lastErrorMessage: true,
      createdAt: true,
    },
  });

  console.log(
    '[recovery-demo.list]',
    rows.map((row) => ({
      orderToken: row.orderToken,
      customerEmail: row.customerEmail,
      status: row.status,
      createdAt: row.createdAt,
      lastErrorCode: row.lastErrorCode,
      lastErrorMessage: row.lastErrorMessage,
      recoveryLookupFields: {
        hasCapturePayload: row.capturePayload !== null,
        hasDjangoOrderIntentOrderId: row.djangoOrderIntentOrderId !== null,
        hasDjangoOrderIntentVerifyPayload: row.djangoOrderIntentVerifyPayload !== null,
        processingCompletedAt: row.processingCompletedAt,
      },
      recoveryPreviewFields: {
        hasPaidAmount: Boolean(
          (row.capturePayload as { amount?: unknown } | null)?.amount,
        ),
        hasCartSnapshot: Array.isArray(row.cartSnapshot) && row.cartSnapshot.length > 0,
        hasShippingSnapshot: row.shippingSnapshot !== null,
      },
      matchesRecoveryLookup:
        row.processingCompletedAt === null &&
        row.capturePayload !== null &&
        row.djangoOrderIntentOrderId !== null &&
        row.djangoOrderIntentVerifyPayload !== null &&
        ['captured', 'receipt_uploaded', 'payment_saved', 'error'].includes(row.status),
    })),
  );
}

async function cleanupDemoIntents(email: string) {
  const normalizedEmail = normalizeEmail(email);

  const otpResult = await paypalTxLedger.checkoutRecoveryOtpChallenge.deleteMany({
    where: {
      email: normalizedEmail,
    },
  });
  const result = await paypalTxLedger.paypalIntent.deleteMany({
    where: {
      customerEmail: normalizedEmail,
      orderToken: {
        startsWith: DEMO_TOKEN_PREFIX,
      },
    },
  });

  console.log('[recovery-demo.cleanup]', {
    email: normalizedEmail,
    deletedOtpChallengeCount: otpResult.count,
    deletedCount: result.count,
  });
}

async function cleanupAllDemoIntents() {
  const demoRows = await paypalTxLedger.paypalIntent.findMany({
    where: {
      orderToken: {
        startsWith: DEMO_TOKEN_PREFIX,
      },
    },
    select: {
      customerEmail: true,
    },
    distinct: ['customerEmail'],
  });
  const demoEmails = demoRows.map((row) => row.customerEmail);

  const otpResult = demoEmails.length
    ? await paypalTxLedger.checkoutRecoveryOtpChallenge.deleteMany({
        where: {
          email: {
            in: demoEmails,
          },
        },
      })
    : { count: 0 };
  const result = await paypalTxLedger.paypalIntent.deleteMany({
    where: {
      orderToken: {
        startsWith: DEMO_TOKEN_PREFIX,
      },
    },
  });

  console.log('[recovery-demo.cleanup-all]', {
    demoEmailCount: demoEmails.length,
    deletedOtpChallengeCount: otpResult.count,
    deletedCount: result.count,
  });
}

async function main() {
  const action = process.argv[2] ?? 'create';
  const email = process.argv[3] ?? process.env.DEMO_RECOVERY_EMAIL;

  if (action === 'cleanup-all') {
    await cleanupAllDemoIntents();
    return;
  }

  if (!email) throw new Error('Provide an email for create, list, or cleanup.');

  if (action === 'create') {
    await createDemoIntent(email);
    return;
  }

  if (action === 'list') {
    await listDemoIntents(email);
    return;
  }

  if (action === 'cleanup') {
    await cleanupDemoIntents(email);
    return;
  }

  throw new Error(`Unknown action "${action}". Use create, list, cleanup, or cleanup-all.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await paypalTxLedger.$disconnect();
  });

import path from 'node:path';
import { randomUUID } from 'node:crypto';
import * as dotenv from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../src/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

const DEMO_TOKEN_PREFIX = 'demo-recovery-';

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

const paypalTxLedger = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: getPaypalLedgerConnectionString(),
  }),
});

async function createDemoIntent(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const orderToken = `${DEMO_TOKEN_PREFIX}${randomUUID()}`;

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
      cartSnapshot: [
        {
          variantId: 'demo-variant-001',
          quantity: 1,
          title: 'Demo Recovery Test Product',
          slug: 'demo-recovery-test-product',
          itemDetail: {
            _id: 'demo-item-detail-001',
            image_uris: [],
            retail_price: 24.99,
            is_default: true,
            sku: 'DEMO-MERCHIZE-SKU',
            sku_seller: 'DEMO-SELLER-SKU',
            title: 'Demo Recovery Test Product',
            options: [],
            image: '',
          },
        },
      ],
      shippingSnapshot: {
        shipping_address_line_1: '123 Demo Recovery Street',
        shipping_address_line_2: '',
        shipping_city: 'Los Angeles',
        shipping_state: 'CA',
        shipping_country: 'USA',
        zip_code: '90001',
      },
      capturePayload: {
        id: `${DEMO_TOKEN_PREFIX}capture-${randomUUID()}`,
        status: 'COMPLETED',
        demo: true,
      },
      djangoOrderIntentUuid: `${DEMO_TOKEN_PREFIX}django-intent-uuid`,
      djangoOrderIntentOrderId: `${DEMO_TOKEN_PREFIX}django-intent-order-id`,
      djangoPaymentSaveCustomId: `${DEMO_TOKEN_PREFIX}django-payment-save-custom-id`,
      status: 'payment_saved',
      lastEventType: 'PAYMENT.CAPTURE.COMPLETED',
      lastErrorCode: 'POST_PROCESSING_FAILED',
      lastErrorMessage: 'Demo unresolved checkout for recovery OTP testing.',
    },
  });

  console.log('[recovery-demo.create]', {
    email: row.customerEmail,
    orderToken: row.orderToken,
    status: row.status,
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
      lastErrorCode: true,
      lastErrorMessage: true,
      createdAt: true,
    },
  });

  console.log('[recovery-demo.list]', rows);
}

async function cleanupDemoIntents(email: string) {
  const normalizedEmail = normalizeEmail(email);

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
    deletedCount: result.count,
  });
}

async function main() {
  const action = process.argv[2] ?? 'create';
  const email = process.argv[3] ?? process.env.DEMO_RECOVERY_EMAIL;

  if (!email) {
    throw new Error(
      'Provide an email: yarn tsx prisma/shop/paypal/seedCheckoutRecoveryDemoPaypalIntent.ts create test@example.com',
    );
  }

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

  throw new Error(`Unknown action "${action}". Use create, list, or cleanup.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await paypalTxLedger.$disconnect();
  });

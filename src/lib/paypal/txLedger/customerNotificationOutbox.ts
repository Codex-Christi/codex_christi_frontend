import 'server-only';

import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { buildShopFulfillmentEmail } from '@/lib/shop/email/templates';

const DEFAULT_PENDING_SEND_LIMIT = 25;

export const CUSTOMER_NOTIFICATION_TYPE = {
  PAID_ORDER_FULFILLMENT_PUSH_VERIFIED: 'paid_order_fulfillment_push_verified',
} as const;

export const CUSTOMER_NOTIFICATION_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
  SUPPRESSED: 'suppressed',
} as const;

type CustomerNotificationDb = Pick<typeof paypalTxLedger, 'customerNotificationOutbox'>;
type CustomerNotificationOutboxDelegate = CustomerNotificationDb['customerNotificationOutbox'];
type CustomerNotificationRow = Awaited<ReturnType<CustomerNotificationOutboxDelegate['findFirst']>>;

type CustomerFulfillmentPushVerifiedPayload = {
  orderToken: string;
  paypalOrderId?: string | null;
  customerName: string;
  customerEmail: string;
  receiptLink?: string | null;
  supportReference: string;
};

type EnqueueCustomerFulfillmentPushVerifiedProps = {
  db?: CustomerNotificationDb;
  orderToken: string;
  paypalOrderId?: string | null;
  customerName: string;
  customerEmail: string;
  receiptLink?: string | null;
};

function getCustomerNotificationOutboxDelegate(db: CustomerNotificationDb = paypalTxLedger) {
  return (db as Partial<CustomerNotificationDb>).customerNotificationOutbox ?? null;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildDedupeKey(orderToken: string, recipient: string) {
  return [
    CUSTOMER_NOTIFICATION_TYPE.PAID_ORDER_FULFILLMENT_PUSH_VERIFIED,
    orderToken,
    recipient,
  ].join(':');
}

export async function enqueueCustomerFulfillmentPushVerifiedNotification({
  db = paypalTxLedger,
  orderToken,
  paypalOrderId,
  customerName,
  customerEmail,
  receiptLink,
}: EnqueueCustomerFulfillmentPushVerifiedProps) {
  const outbox = getCustomerNotificationOutboxDelegate(db);
  const recipient = normalizeEmail(customerEmail);

  if (!recipient) {
    return { created: 0, skipped: true as const };
  }

  if (!outbox) {
    throw new Error(
      'Customer notification outbox is unavailable. Regenerate the PayPal ledger Prisma client and restart the server.',
    );
  }

  const payload: CustomerFulfillmentPushVerifiedPayload = {
    orderToken,
    paypalOrderId,
    customerName,
    customerEmail: recipient,
    receiptLink,
    supportReference: orderToken,
  };

  const result = await outbox.createMany({
    data: [
      {
        orderToken,
        paypalOrderId,
        type: CUSTOMER_NOTIFICATION_TYPE.PAID_ORDER_FULFILLMENT_PUSH_VERIFIED,
        status: CUSTOMER_NOTIFICATION_STATUS.PENDING,
        dedupeKey: buildDedupeKey(orderToken, recipient),
        recipient,
        payload,
      },
    ],
    skipDuplicates: true,
  });

  return { created: result.count, skipped: false as const };
}

async function sendCustomerNotificationRow(
  row: CustomerNotificationRow,
  outbox: CustomerNotificationOutboxDelegate | null = getCustomerNotificationOutboxDelegate(),
) {
  if (!row) {
    return { id: null, ok: false as const, error: 'Notification row was not found.' };
  }

  if (!outbox) {
    return {
      id: row.id,
      ok: false as const,
      error:
        'Customer notification outbox is unavailable. Regenerate the PayPal ledger Prisma client and restart the server.',
    };
  }

  const payload = row.payload as CustomerFulfillmentPushVerifiedPayload;

  try {
    const { sendMailFromPrimaryAgent } = await import('@/lib/zeptomail/sendMailFromPrimaryAgent');

    await sendMailFromPrimaryAgent({
      emailReceipents: [
        {
          email_address: {
            address: row.recipient,
            name: payload.customerName || 'Codex Christi Customer',
          },
        },
      ],
      ...buildShopFulfillmentEmail({
        customerName: payload.customerName,
        orderToken: payload.orderToken,
        supportReference: payload.supportReference,
        receiptAvailable: Boolean(payload.receiptLink),
      }),
    });

    await outbox.update({
      where: { id: row.id },
      data: {
        status: CUSTOMER_NOTIFICATION_STATUS.SENT,
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        sentAt: new Date(),
        lastErrorMessage: null,
      },
    });

    return { id: row.id, ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);

    await outbox.update({
      where: { id: row.id },
      data: {
        status: CUSTOMER_NOTIFICATION_STATUS.FAILED,
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        lastErrorMessage: message,
      },
    });

    return { id: row.id, ok: false as const, error: message };
  }
}

export async function sendPendingCustomerNotifications(limit = DEFAULT_PENDING_SEND_LIMIT) {
  const outbox = getCustomerNotificationOutboxDelegate();
  if (!outbox) return [];

  const rows = await outbox.findMany({
    where: {
      status: {
        in: [CUSTOMER_NOTIFICATION_STATUS.PENDING, CUSTOMER_NOTIFICATION_STATUS.FAILED],
      },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  const results = [];

  for (const row of rows) {
    results.push(await sendCustomerNotificationRow(row, outbox));
  }

  return results;
}

export async function sendPendingCustomerNotificationsForOrder(orderToken: string) {
  const outbox = getCustomerNotificationOutboxDelegate();
  if (!outbox) return [];

  const rows = await outbox.findMany({
    where: {
      orderToken,
      status: {
        in: [CUSTOMER_NOTIFICATION_STATUS.PENDING, CUSTOMER_NOTIFICATION_STATUS.FAILED],
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const results = [];

  for (const row of rows) {
    results.push(await sendCustomerNotificationRow(row, outbox));
  }

  return results;
}

export async function resendCustomerNotification(id: string) {
  const outbox = getCustomerNotificationOutboxDelegate();
  if (!outbox) {
    return {
      id,
      ok: false as const,
      error:
        'Customer notification outbox is unavailable. Regenerate the PayPal ledger Prisma client and restart the server.',
    };
  }

  const row = await outbox.update({
    where: { id },
    data: {
      status: CUSTOMER_NOTIFICATION_STATUS.PENDING,
      lastErrorMessage: null,
    },
  });

  return sendCustomerNotificationRow(row, outbox);
}

export async function listCustomerNotificationsForOrder(orderToken: string) {
  const outbox = getCustomerNotificationOutboxDelegate();
  if (!outbox) return [];

  return outbox.findMany({
    where: { orderToken },
    orderBy: { createdAt: 'desc' },
  });
}

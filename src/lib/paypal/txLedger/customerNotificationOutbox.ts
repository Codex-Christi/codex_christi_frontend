import 'server-only';

import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import {
  buildShopAddressCorrectionEmail,
  buildShopFulfillmentEmail,
  buildShopFulfillmentMilestoneEmail,
  type ShopFulfillmentNotice,
} from '@/lib/shop/email/templates';
import { customerAddressCorrectionState } from '@/lib/shop/checkout/customerAddressCorrection';

const DEFAULT_PENDING_SEND_LIMIT = 25;

export const CUSTOMER_NOTIFICATION_TYPE = {
  PAID_ORDER_FULFILLMENT_PUSH_VERIFIED: 'paid_order_fulfillment_push_verified',
  PAID_ORDER_ADDRESS_CORRECTION_REQUIRED: 'paid_order_address_correction_required',
  PAID_ORDER_PRODUCTION_STARTED: 'paid_order_production_started',
  PAID_ORDER_SHIPMENT_STARTED: 'paid_order_shipment_started',
  PAID_ORDER_DELIVERED: 'paid_order_delivered',
} as const;

const milestoneTypes = {
  production: CUSTOMER_NOTIFICATION_TYPE.PAID_ORDER_PRODUCTION_STARTED,
  shipment: CUSTOMER_NOTIFICATION_TYPE.PAID_ORDER_SHIPMENT_STARTED,
  delivery: CUSTOMER_NOTIFICATION_TYPE.PAID_ORDER_DELIVERED,
} as const;

function noticeForType(type: string) {
  return (Object.keys(milestoneTypes) as ShopFulfillmentNotice[]).find(
    (notice) => milestoneTypes[notice] === type,
  );
}

export const CUSTOMER_NOTIFICATION_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  SENDING: 'sending',
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

export async function enqueueCustomerFulfillmentPushVerifiedNotification(props: EnqueueCustomerFulfillmentPushVerifiedProps) {
  return enqueueCustomerNotification(CUSTOMER_NOTIFICATION_TYPE.PAID_ORDER_FULFILLMENT_PUSH_VERIFIED, props);
}

export async function enqueueCustomerAddressCorrectionNotification(props: EnqueueCustomerFulfillmentPushVerifiedProps) {
  return enqueueCustomerNotification(CUSTOMER_NOTIFICATION_TYPE.PAID_ORDER_ADDRESS_CORRECTION_REQUIRED, props);
}

export async function enqueueCustomerFulfillmentMilestoneNotification(
  notice: ShopFulfillmentNotice,
  props: EnqueueCustomerFulfillmentPushVerifiedProps,
) {
  return enqueueCustomerNotification(milestoneTypes[notice], props, true);
}

async function enqueueCustomerNotification(type: (typeof CUSTOMER_NOTIFICATION_TYPE)[keyof typeof CUSTOMER_NOTIFICATION_TYPE], {
  db = paypalTxLedger,
  orderToken,
  paypalOrderId,
  customerName,
  customerEmail,
  receiptLink,
}: EnqueueCustomerFulfillmentPushVerifiedProps, oncePerOrder = false) {
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
        type,
        status: CUSTOMER_NOTIFICATION_STATUS.PENDING,
        dedupeKey: oncePerOrder ? `${type}:${orderToken}` : `${type}:${orderToken}:${recipient}`,
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
    const isAddressNotice = row.type === CUSTOMER_NOTIFICATION_TYPE.PAID_ORDER_ADDRESS_CORRECTION_REQUIRED;
    const milestone = noticeForType(row.type);
    if (isAddressNotice) {
      const current = await paypalTxLedger.paypalIntent.findUnique({
        where: { orderToken: row.orderToken },
        select: {
          status: true, lastErrorCode: true, fulfillmentAddressOverriddenAt: true,
          fulfillmentAddressOverriddenBy: true, processingCompletedAt: true, customerEmail: true,
        },
      });
      if (!current || current.processingCompletedAt || normalizeEmail(current.customerEmail) !== row.recipient ||
        customerAddressCorrectionState(current) !== 'required') {
        await outbox.update({ where: { id: row.id }, data: { status: CUSTOMER_NOTIFICATION_STATUS.SUPPRESSED } });
        return { id: row.id, ok: false as const, error: 'This order no longer needs an address correction notice.' };
      }
    }
    if (milestone) {
      const claimed = await outbox.updateMany({
        where: {
          id: row.id,
          status: { in: [CUSTOMER_NOTIFICATION_STATUS.PENDING, CUSTOMER_NOTIFICATION_STATUS.FAILED] },
          attemptCount: row.attemptCount,
        },
        data: { status: CUSTOMER_NOTIFICATION_STATUS.SENDING, lastAttemptAt: new Date() },
      });
      if (claimed.count !== 1) {
        return { id: row.id, ok: false as const, error: 'The notice is already being sent or has been handled.' };
      }
      const current = await paypalTxLedger.paypalIntent.findUnique({
        where: { orderToken: row.orderToken },
        select: { status: true, processingCompletedAt: true, customerEmail: true },
      });
      if (current?.status !== 'completed' || !current.processingCompletedAt ||
        normalizeEmail(current.customerEmail) !== row.recipient) {
        await outbox.update({ where: { id: row.id }, data: { status: CUSTOMER_NOTIFICATION_STATUS.SUPPRESSED } });
        return { id: row.id, ok: false as const, error: 'The paid order or its contact changed after the notice was queued.' };
      }
    }
    const email = isAddressNotice
      ? buildShopAddressCorrectionEmail(row.orderToken)
      : milestone
        ? buildShopFulfillmentMilestoneEmail(milestone, row.orderToken)
        : buildShopFulfillmentEmail({
            customerName: payload.customerName,
            orderToken: payload.orderToken,
            supportReference: payload.supportReference,
            receiptAvailable: Boolean(payload.receiptLink),
          });
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
      ...email,
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

export async function sendPendingCustomerNotificationsForOrder(orderToken: string, milestone?: ShopFulfillmentNotice) {
  const outbox = getCustomerNotificationOutboxDelegate();
  if (!outbox) return [];

  const rows = await outbox.findMany({
    where: {
      orderToken,
      ...(milestone ? { type: milestoneTypes[milestone] } : {}),
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

  const current = await outbox.findUnique({ where: { id } });
  if (current && noticeForType(current.type)) {
    return sendCustomerNotificationRow(current, outbox);
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

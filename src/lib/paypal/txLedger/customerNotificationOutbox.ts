import 'server-only';

import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import {
  buildShopAddressCorrectionEmail,
  buildShopFulfillmentEmail,
  buildShopFulfillmentMilestoneEmail,
  type ShopFulfillmentNotice,
} from '@/lib/shop/email/templates';
import { customerAddressCorrectionState } from '@/lib/shop/checkout/customerAddressCorrection';
import { getCanonicalPaymentProjectionState } from './canonicalPaymentProjectionState';
import { isAcceptedDjangoFulfillmentProcessResponse } from './fulfillmentProcessResponse';

const DEFAULT_PENDING_SEND_LIMIT = 25;
const MAX_AUTOMATIC_ATTEMPTS = 3;
const RETRY_DELAY_MS = 15 * 60_000;
const RETRYABLE_REJECTION = 'The email was not submitted. A scheduled retry may be attempted.';
const UNKNOWN_DELIVERY = 'Email submission could not be confirmed. Check ZeptoMail before retrying.';

export const CUSTOMER_NOTIFICATION_TYPE = {
  PAID_ORDER_RECEIVED: 'paid_order_received',
  PAID_ORDER_FULFILLMENT_PUSH_VERIFIED: 'paid_order_fulfillment_push_verified',
  PAID_ORDER_ADDRESS_CORRECTION_REQUIRED: 'paid_order_address_correction_required',
  PAID_ORDER_PRODUCTION_STARTED: 'paid_order_production_started',
  PAID_ORDER_SHIPMENT_STARTED: 'paid_order_shipment_started',
  PAID_ORDER_DELIVERED: 'paid_order_delivered',
} as const;

const milestoneTypes = {
  received: CUSTOMER_NOTIFICATION_TYPE.PAID_ORDER_RECEIVED,
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
  DELIVERY_UNKNOWN: 'delivery_unknown',
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

function requestDidNotReachMailService(error: unknown) {
  const cause = error instanceof Error ? error.cause : null;
  const readCode = (value: unknown) =>
    value && typeof value === 'object' && 'code' in value ? value.code : null;
  return ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'UND_ERR_CONNECT_TIMEOUT']
    .includes(String(readCode(cause) ?? readCode(error)));
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
    return { created: 0, skipped: true as const, queuedKey: null };
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

  const dedupeKey = oncePerOrder ? `${type}:${orderToken}` : `${type}:${orderToken}:${recipient}`;
  const result = await outbox.createMany({
    data: [
      {
        orderToken,
        paypalOrderId,
        type,
        status: CUSTOMER_NOTIFICATION_STATUS.PENDING,
        dedupeKey,
        recipient,
        payload,
      },
    ],
    skipDuplicates: true,
  });

  return { created: result.count, skipped: false as const, queuedKey: result.count === 1 ? dedupeKey : null };
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

  let submitted = false;
  try {
    const isAddressNotice = row.type === CUSTOMER_NOTIFICATION_TYPE.PAID_ORDER_ADDRESS_CORRECTION_REQUIRED;
    const milestone = noticeForType(row.type);
    const current = await paypalTxLedger.paypalIntent.findUnique({
      where: { orderToken: row.orderToken },
    });
    const payment = current && getCanonicalPaymentProjectionState(current);
    const recognizedType = isAddressNotice || milestone ||
      row.type === CUSTOMER_NOTIFICATION_TYPE.PAID_ORDER_FULFILLMENT_PUSH_VERIFIED;
    const stillEligible = recognizedType && current && payment?.captureCompletion.ok &&
      payment.paymentSafeForPostProcessing &&
      current.status !== 'refunded' &&
      normalizeEmail(current.customerEmail) === row.recipient &&
      (isAddressNotice
        ? !current.processingCompletedAt && customerAddressCorrectionState(current) === 'required'
        : current.djangoPaymentSaveCustomId &&
          isAcceptedDjangoFulfillmentProcessResponse(current.merchizeFulfillmentResponsePayload) &&
          (milestone === 'received' || (current.status === 'completed' && current.processingCompletedAt)));
    if (!stillEligible) {
      await outbox.update({ where: { id: row.id }, data: { status: CUSTOMER_NOTIFICATION_STATUS.SUPPRESSED } });
      return { id: row.id, ok: false as const, error: 'The order no longer qualifies for this notice.' };
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
    submitted = true;
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
  } catch (error) {
    const retryable = !submitted || requestDidNotReachMailService(error);
    const message = retryable ? RETRYABLE_REJECTION : UNKNOWN_DELIVERY;
    await outbox.update({
      where: { id: row.id },
      data: {
        status: retryable ? CUSTOMER_NOTIFICATION_STATUS.FAILED : CUSTOMER_NOTIFICATION_STATUS.DELIVERY_UNKNOWN,
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        lastErrorMessage: message,
      },
    });

    return { id: row.id, ok: false as const, error: message };
  }

  // If recording acceptance fails, leave the claim in place. Resending could duplicate the email.
  await outbox.update({
    where: { id: row.id },
    data: {
      status: CUSTOMER_NOTIFICATION_STATUS.SENT,
      attemptCount: { increment: 1 },
      sentAt: new Date(),
      lastErrorMessage: null,
    },
  });
  return { id: row.id, ok: true as const };
}

// Call after the transaction commits. Cron and this path share the same delivery claim.
export async function trySendQueuedUrgentCustomerNotification(queued?: { queuedKey: string | null }) {
  if (!queued?.queuedKey) return;

  try {
    const outbox = getCustomerNotificationOutboxDelegate();
    const row = await outbox?.findUnique({ where: { dedupeKey: queued.queuedKey } });
    if (
      row?.status === CUSTOMER_NOTIFICATION_STATUS.PENDING &&
      (row.type === CUSTOMER_NOTIFICATION_TYPE.PAID_ORDER_RECEIVED ||
        row.type === CUSTOMER_NOTIFICATION_TYPE.PAID_ORDER_ADDRESS_CORRECTION_REQUIRED)
    ) {
      await sendCustomerNotificationRow(row, outbox);
    }
  } catch {
    console.warn('[CustomerNotificationOutbox] Could not complete the immediate email attempt. Check the outbox status.');
  }
}

export async function sendPendingCustomerNotifications({
  limit = DEFAULT_PENDING_SEND_LIMIT, orderToken,
}: { limit?: number; orderToken?: string } = {}) {
  const outbox = getCustomerNotificationOutboxDelegate();
  if (!outbox) return [];

  const rows = await outbox.findMany({
    where: {
      orderToken,
      OR: [
        { status: CUSTOMER_NOTIFICATION_STATUS.PENDING },
        {
          status: CUSTOMER_NOTIFICATION_STATUS.FAILED,
          attemptCount: { lt: MAX_AUTOMATIC_ATTEMPTS },
          lastAttemptAt: { lte: new Date(Date.now() - RETRY_DELAY_MS) },
          lastErrorMessage: RETRYABLE_REJECTION,
        },
      ],
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: Math.min(Math.max(1, limit), DEFAULT_PENDING_SEND_LIMIT),
  });

  const results = [];

  for (const row of rows) {
    results.push(await sendCustomerNotificationRow(row, outbox).catch(() => ({
      id: row.id,
      ok: false as const,
      error: 'Could not record this email attempt. Check the outbox before resending.',
    })));
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
  return sendCustomerNotificationRow(current, outbox);
}

export async function listCustomerNotificationsForOrder(orderToken: string) {
  const outbox = getCustomerNotificationOutboxDelegate();
  if (!outbox) return [];

  return outbox.findMany({
    where: { orderToken },
    orderBy: { createdAt: 'desc' },
  });
}

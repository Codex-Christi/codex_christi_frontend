import 'server-only';

import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { getMainSiteUrl } from '@/lib/siteBaseUrls';

const DEFAULT_PENDING_SEND_LIMIT = 25;

export const CUSTOMER_NOTIFICATION_TYPE = {
  PAID_ORDER_FULFILLMENT_PUSH_ACCEPTED: 'paid_order_fulfillment_push_accepted',
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

type CustomerFulfillmentPushAcceptedPayload = {
  orderToken: string;
  paypalOrderId?: string | null;
  customerName: string;
  customerEmail: string;
  receiptLink?: string | null;
  supportReference: string;
};

type EnqueueCustomerFulfillmentPushAcceptedProps = {
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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function buildDedupeKey(orderToken: string, recipient: string) {
  return [
    CUSTOMER_NOTIFICATION_TYPE.PAID_ORDER_FULFILLMENT_PUSH_ACCEPTED,
    orderToken,
    recipient,
  ].join(':');
}

function buildCustomerFulfillmentPushAcceptedEmailHtml(
  payload: CustomerFulfillmentPushAcceptedPayload,
) {
  const logoUrl = getMainSiteUrl('/media/img/general/logo-glow-tiny.jpg');
  const receiptLink = payload.receiptLink
    ? `<a href="${escapeHtml(payload.receiptLink)}" style="display:inline-block;margin-top:14px;border-radius:12px;background:#dbeafe;color:#0f172a;text-decoration:none;font-size:13px;font-weight:700;padding:12px 18px;">View Receipt</a>`
    : '';

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;color:#0f172a;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:28px 14px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;">
            <tr>
              <td style="padding:0 0 18px;">
                <img src="${escapeHtml(logoUrl)}" width="44" height="44" alt="Codex Christi" style="border-radius:12px;vertical-align:middle;" />
                <span style="display:inline-block;margin-left:12px;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#475569;vertical-align:middle;">Codex Christi</span>
              </td>
            </tr>
            <tr>
              <td style="border:1px solid #e2e8f0;border-radius:18px;background:#ffffff;padding:26px;">
                <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#0284c7;font-weight:700;">Order Update</div>
                <h1 style="margin:12px 0 8px;font-size:24px;line-height:1.25;color:#0f172a;">We are preparing your order</h1>
                <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#475569;">
                  Hi ${escapeHtml(payload.customerName || 'there')}, your payment has been received and your order has moved into fulfillment preparation.
                </p>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;">
                  <tr>
                    <td style="padding:14px 16px 6px;color:#64748b;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;">Support Reference</td>
                  </tr>
                  <tr>
                    <td style="padding:0 16px 14px;color:#0f172a;font-size:13px;line-height:1.5;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">${escapeHtml(payload.supportReference)}</td>
                  </tr>
                </table>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                  Keep this reference for support. We will use it to locate your order quickly if you contact us.
                </p>
                ${receiptLink}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function enqueueCustomerFulfillmentPushAcceptedNotification({
  db = paypalTxLedger,
  orderToken,
  paypalOrderId,
  customerName,
  customerEmail,
  receiptLink,
}: EnqueueCustomerFulfillmentPushAcceptedProps) {
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

  const payload: CustomerFulfillmentPushAcceptedPayload = {
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
        type: CUSTOMER_NOTIFICATION_TYPE.PAID_ORDER_FULFILLMENT_PUSH_ACCEPTED,
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
      error: 'Customer notification outbox is unavailable. Regenerate the PayPal ledger Prisma client and restart the server.',
    };
  }

  const payload = row.payload as CustomerFulfillmentPushAcceptedPayload;

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
      subject: `We are preparing your order · ${payload.supportReference.slice(0, 8)}`,
      htmlbody: buildCustomerFulfillmentPushAcceptedEmailHtml(payload),
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
      error: 'Customer notification outbox is unavailable. Regenerate the PayPal ledger Prisma client and restart the server.',
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

import 'server-only';

import {
  ADMIN_NOTIFICATION_RECIPIENT_GROUP_KEY,
  resolveAdminNotificationRecipients,
} from '@/lib/admin/admin-notification-recipients';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { getMainSiteUrl } from '@/lib/siteBaseUrls';

const DEFAULT_PENDING_SEND_LIMIT = 25;

export const ADMIN_NOTIFICATION_TYPE = {
  PAID_ORDER_RECOVERY_REQUIRED: 'paid_order_recovery_required',
  PAID_ORDER_FULFILLMENT_PUSH_ACCEPTED: 'paid_order_fulfillment_push_accepted',
  PAYPAL_LEDGER_WEBHOOK_DRIFT: 'paypal_ledger_webhook_drift',
  PAYMENT_RECONCILIATION_REQUIRED: 'payment_reconciliation_required',
} as const;

export const ADMIN_NOTIFICATION_STAGE = {
  PAYMENT: 'payment',
  FULFILLMENT: 'fulfillment',
  WEBHOOK: 'webhook',
} as const;

export const ADMIN_NOTIFICATION_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
} as const;

export const ADMIN_NOTIFICATION_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
  SUPPRESSED: 'suppressed',
} as const;

type AdminNotificationDb = Pick<typeof paypalTxLedger, 'adminNotificationOutbox'>;

type AdminRecoveryNotificationPayload = {
  orderToken: string;
  paypalOrderId?: string | null;
  customerName: string;
  customerEmail: string;
  ledgerStatus: string;
  errorCode: string;
  errorMessage: string;
  issueSummary: string[];
  receiptLink?: string | null;
  supportReference: string;
  adminDetailUrl: string;
  alertLabel?: string;
  eyebrow?: string;
  heading?: string;
  intro?: string;
  buttonLabel?: string;
  footnote?: string;
};

type AdminFulfillmentPushAcceptedNotificationPayload = {
  orderToken: string;
  paypalOrderId?: string | null;
  customerName: string;
  customerEmail: string;
  receiptLink?: string | null;
  supportReference: string;
  merchizeExternalOrderNumber?: string | null;
  merchizeOrderId?: string | null;
  merchizeOrderCode?: string | null;
  adminDetailUrl: string;
};

type AdminPayPalLedgerWebhookDriftNotificationPayload = {
  activationSource: string;
  dashboardUrl: string;
  dbWebhookId?: string | null;
  envVarName: string;
  envWebhookId?: string | null;
  label: string;
  message: string;
  supportReference: string;
  syncStatus: string;
};

type EnqueueAdminRecoveryNotificationProps = {
  db?: AdminNotificationDb;
  orderToken: string;
  paypalOrderId?: string | null;
  customerName: string;
  customerEmail: string;
  ledgerStatus: string;
  errorCode: string;
  errorMessage: string;
  issueSummary?: string[];
  receiptLink?: string | null;
  type?: (typeof ADMIN_NOTIFICATION_TYPE)[keyof typeof ADMIN_NOTIFICATION_TYPE];
  stage?: (typeof ADMIN_NOTIFICATION_STAGE)[keyof typeof ADMIN_NOTIFICATION_STAGE];
  severity?: (typeof ADMIN_NOTIFICATION_SEVERITY)[keyof typeof ADMIN_NOTIFICATION_SEVERITY];
  recipientGroupKey?: string;
};

type EnqueueAdminFulfillmentPushAcceptedNotificationProps = {
  db?: AdminNotificationDb;
  orderToken: string;
  paypalOrderId?: string | null;
  customerName: string;
  customerEmail: string;
  receiptLink?: string | null;
  merchizeExternalOrderNumber?: string | null;
  merchizeOrderId?: string | null;
  merchizeOrderCode?: string | null;
};

type EnqueueAdminPaymentReconciliationNotificationProps = Omit<
  EnqueueAdminRecoveryNotificationProps,
  'type' | 'stage' | 'recipientGroupKey' | 'severity'
> & {
  severity?: (typeof ADMIN_NOTIFICATION_SEVERITY)[keyof typeof ADMIN_NOTIFICATION_SEVERITY];
};

type EnqueueAdminPayPalLedgerWebhookDriftNotificationProps = {
  activationSource: string;
  dbWebhookId?: string | null;
  envVarName: string;
  envWebhookId?: string | null;
  label: string;
  message: string;
  severity?: (typeof ADMIN_NOTIFICATION_SEVERITY)[keyof typeof ADMIN_NOTIFICATION_SEVERITY];
  syncStatus: string;
};

function getConfiguredAdminRecipients() {
  return (process.env.ORDER_RECOVERY_ADMIN_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function buildAdminOrderRecoveryUrl(orderToken: string) {
  return getMainSiteUrl(`/admin/shop/paid-order-recovery/${encodeURIComponent(orderToken)}`);
}

function buildAdminPayPalLedgerWebhooksUrl() {
  return getMainSiteUrl('/admin/shop/paypal-webhooks');
}

function buildNotificationDedupeKey({
  orderToken,
  recipient,
  type,
  stage,
  errorCode,
}: {
  orderToken: string;
  recipient: string;
  type: string;
  stage: string;
  errorCode: string;
}) {
  return [type, stage, orderToken, errorCode, recipient].join(':');
}

function buildGenericNotificationDedupeKey(parts: string[]) {
  return parts.join(':');
}

function toIssueSummary(errorMessage: string) {
  return errorMessage
    .split('\n')
    .map((issue) => issue.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildAdminRecoveryAlertEmailHtml(payload: AdminRecoveryNotificationPayload) {
  const logoUrl = getMainSiteUrl('/media/img/general/logo-glow-tiny.jpg');
  const issueRows = payload.issueSummary
    .map(
      (issue) => `
        <tr>
          <td style="padding:10px 0;border-top:1px solid rgba(148,163,184,0.16);color:#dbeafe;font-size:13px;line-height:1.5;">
            ${escapeHtml(issue)}
          </td>
        </tr>`,
    )
    .join('');

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#05070d;color:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#05070d;padding:28px 14px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;">
            <tr>
              <td style="padding:0 0 18px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <img src="${escapeHtml(logoUrl)}" width="48" height="48" alt="Codex Christi" style="border-radius:14px;border:1px solid rgba(255,255,255,0.14);vertical-align:middle;" />
                      <span style="display:inline-block;margin-left:12px;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:#94a3b8;vertical-align:middle;">Codex Christi Ops</span>
                    </td>
                    <td align="right" style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#fbbf24;">
                      ${escapeHtml(payload.alertLabel ?? 'Recovery Alert')}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="border:1px solid rgba(96,165,250,0.22);border-radius:22px;background:#0b1020;padding:28px;">
                <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#60a5fa;font-weight:700;">${escapeHtml(payload.eyebrow ?? 'Paid Order Requires Attention')}</div>
                <h1 style="margin:12px 0 8px;font-size:24px;line-height:1.25;color:#ffffff;">${escapeHtml(payload.heading ?? 'A paid checkout stopped during fulfillment')}</h1>
                <p style="margin:0 0 22px;font-size:14px;line-height:1.65;color:#cbd5e1;">
                  ${escapeHtml(
                    payload.intro ??
                      'This order is already paid, but the fulfillment stage did not complete cleanly. Review the transaction before the customer needs to contact support.',
                  )}
                </p>

                <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid rgba(148,163,184,0.16);border-radius:16px;background:#0f172a;">
                  <tr>
                    <td style="padding:16px 18px 6px;color:#94a3b8;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;">Customer</td>
                    <td style="padding:16px 18px 6px;color:#94a3b8;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;">Ledger Status</td>
                  </tr>
                  <tr>
                    <td style="padding:0 18px 16px;color:#f8fafc;font-size:14px;line-height:1.5;">
                      ${escapeHtml(payload.customerName)}<br />
                      <span style="color:#94a3b8;">${escapeHtml(payload.customerEmail)}</span>
                    </td>
                    <td style="padding:0 18px 16px;color:#fbbf24;font-size:13px;line-height:1.5;">
                      ${escapeHtml(payload.ledgerStatus.replaceAll('_', ' '))}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 18px 6px;border-top:1px solid rgba(148,163,184,0.16);color:#94a3b8;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;">Support Ref</td>
                    <td style="padding:14px 18px 6px;border-top:1px solid rgba(148,163,184,0.16);color:#94a3b8;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;">Error Code</td>
                  </tr>
                  <tr>
                    <td style="padding:0 18px 16px;color:#e2e8f0;font-size:13px;line-height:1.5;">${escapeHtml(payload.supportReference)}</td>
                    <td style="padding:0 18px 16px;color:#fca5a5;font-size:13px;line-height:1.5;">${escapeHtml(payload.errorCode)}</td>
                  </tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
                  <tr>
                    <td style="padding:0 0 8px;color:#94a3b8;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;">What failed</td>
                  </tr>
                  ${issueRows}
                </table>

                <a href="${escapeHtml(payload.adminDetailUrl)}" style="display:inline-block;border-radius:12px;background:#dbeafe;color:#0f172a;text-decoration:none;font-size:13px;font-weight:700;padding:12px 18px;">${escapeHtml(payload.buttonLabel ?? 'Open Recovery Detail')}</a>

                <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#64748b;">
                  ${escapeHtml(
                    payload.footnote ??
                      'This is an internal operations alert. The customer has already paid; treat this as a recovery task, not a failed checkout attempt.',
                  )}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildAdminFulfillmentPushAcceptedEmailHtml(
  payload: AdminFulfillmentPushAcceptedNotificationPayload,
) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#05070d;color:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#05070d;padding:28px 14px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;">
            <tr>
              <td style="border:1px solid rgba(52,211,153,0.2);border-radius:22px;background:#0b1020;padding:28px;">
                <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#34d399;font-weight:700;">Fulfillment Push Accepted</div>
                <h1 style="margin:12px 0 8px;font-size:24px;line-height:1.25;color:#ffffff;">A paid order moved to fulfillment</h1>
                <p style="margin:0 0 22px;font-size:14px;line-height:1.65;color:#cbd5e1;">
                  Payment, receipt, Django payment save, Django fulfillment processing, provider detail sync, and Merchize push-to-fulfillment completed.
                </p>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid rgba(148,163,184,0.16);border-radius:16px;background:#0f172a;">
                  <tr>
                    <td style="padding:16px 18px 6px;color:#94a3b8;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;">Customer</td>
                    <td style="padding:16px 18px 6px;color:#94a3b8;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;">Support Ref</td>
                  </tr>
                  <tr>
                    <td style="padding:0 18px 16px;color:#f8fafc;font-size:14px;line-height:1.5;">
                      ${escapeHtml(payload.customerName)}<br />
                      <span style="color:#94a3b8;">${escapeHtml(payload.customerEmail)}</span>
                    </td>
                    <td style="padding:0 18px 16px;color:#e2e8f0;font-size:13px;line-height:1.5;">${escapeHtml(payload.supportReference)}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 18px 6px;border-top:1px solid rgba(148,163,184,0.16);color:#94a3b8;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;">Merchize External Number</td>
                    <td style="padding:14px 18px 6px;border-top:1px solid rgba(148,163,184,0.16);color:#94a3b8;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;">Merchize Order ID</td>
                  </tr>
                  <tr>
                    <td style="padding:0 18px 16px;color:#d1fae5;font-size:13px;line-height:1.5;">${escapeHtml(payload.merchizeExternalOrderNumber ?? 'Unavailable')}</td>
                    <td style="padding:0 18px 16px;color:#d1fae5;font-size:13px;line-height:1.5;">${escapeHtml(payload.merchizeOrderId ?? payload.merchizeOrderCode ?? 'Unavailable')}</td>
                  </tr>
                </table>
                <a href="${escapeHtml(payload.adminDetailUrl)}" style="display:inline-block;border-radius:12px;background:#d1fae5;color:#064e3b;text-decoration:none;font-size:13px;font-weight:700;padding:12px 18px;">Open Order Detail</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildAdminPayPalLedgerWebhookDriftEmailHtml(
  payload: AdminPayPalLedgerWebhookDriftNotificationPayload,
) {
  const dbValue = payload.dbWebhookId?.trim() || 'not set';
  const envValue = payload.envWebhookId?.trim() || 'not set';

  return `
    <div style="margin:0;padding:0;background:#020617;color:#e2e8f0;font-family:Inter,Arial,sans-serif;">
      <table role="presentation" style="width:100%;border-collapse:collapse;background:#020617;">
        <tr>
          <td style="padding:32px 18px;">
            <table role="presentation" style="width:100%;max-width:680px;margin:0 auto;border-collapse:collapse;border:1px solid rgba(148,163,184,0.22);border-radius:20px;overflow:hidden;background:#0f172a;">
              <tr>
                <td style="padding:26px 28px 22px;background:#111827;">
                  <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#fbbf24;font-weight:700;">PayPal Ledger Webhook Operations</p>
                  <h1 style="margin:0;font-size:24px;line-height:1.25;color:#ffffff;">Webhook env drift needs review</h1>
                  <p style="margin:12px 0 0;font-size:14px;line-height:1.7;color:#cbd5e1;">${escapeHtml(payload.message)}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:22px 28px;">
                  <table role="presentation" style="width:100%;border-collapse:collapse;">
                    <tr>
                      <td style="padding:10px 0;color:#94a3b8;font-size:13px;">Binding</td>
                      <td style="padding:10px 0;color:#f8fafc;font-size:13px;font-weight:700;text-align:right;">${escapeHtml(payload.label)}</td>
                    </tr>
                    <tr>
                      <td style="padding:10px 0;color:#94a3b8;font-size:13px;">Env variable</td>
                      <td style="padding:10px 0;color:#bae6fd;font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;text-align:right;">${escapeHtml(payload.envVarName)}</td>
                    </tr>
                    <tr>
                      <td style="padding:10px 0;color:#94a3b8;font-size:13px;">DB webhook ID</td>
                      <td style="padding:10px 0;color:#f8fafc;font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;text-align:right;">${escapeHtml(dbValue)}</td>
                    </tr>
                    <tr>
                      <td style="padding:10px 0;color:#94a3b8;font-size:13px;">Runtime env ID</td>
                      <td style="padding:10px 0;color:#f8fafc;font-size:13px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;text-align:right;">${escapeHtml(envValue)}</td>
                    </tr>
                    <tr>
                      <td style="padding:10px 0;color:#94a3b8;font-size:13px;">Activation source</td>
                      <td style="padding:10px 0;color:#f8fafc;font-size:13px;text-align:right;">${escapeHtml(payload.activationSource)}</td>
                    </tr>
                  </table>
                  <div style="margin-top:22px;">
                    <a href="${escapeHtml(payload.dashboardUrl)}" style="display:inline-block;border-radius:12px;background:#fbbf24;color:#111827;text-decoration:none;font-size:13px;font-weight:800;padding:12px 18px;">Open Webhook Dashboard</a>
                  </div>
                  <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">Update the deployment environment when the DB value is the intended trusted webhook ID. Hybrid mode keeps env fallback available for break-glass verification.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

export async function enqueueAdminRecoveryNotification({
  db = paypalTxLedger,
  orderToken,
  paypalOrderId,
  customerName,
  customerEmail,
  ledgerStatus,
  errorCode,
  errorMessage,
  issueSummary,
  receiptLink,
  type = ADMIN_NOTIFICATION_TYPE.PAID_ORDER_RECOVERY_REQUIRED,
  stage = ADMIN_NOTIFICATION_STAGE.FULFILLMENT,
  severity = ADMIN_NOTIFICATION_SEVERITY.CRITICAL,
  recipientGroupKey = ADMIN_NOTIFICATION_RECIPIENT_GROUP_KEY.PAID_ORDER_FULFILLMENT_ISSUES,
}: EnqueueAdminRecoveryNotificationProps) {
  const recipients = await resolveAdminNotificationRecipients({
    groupKey: recipientGroupKey,
    fallbackEmails: getConfiguredAdminRecipients(),
  });

  if (recipients.length === 0) {
    return { created: 0, skipped: true as const };
  }

  const supportReference = orderToken;
  const payload: AdminRecoveryNotificationPayload = {
    orderToken,
    paypalOrderId,
    customerName,
    customerEmail,
    ledgerStatus,
    errorCode,
    errorMessage,
    issueSummary: issueSummary?.length ? issueSummary : toIssueSummary(errorMessage),
    receiptLink,
    supportReference,
    adminDetailUrl: buildAdminOrderRecoveryUrl(orderToken),
    ...(type === ADMIN_NOTIFICATION_TYPE.PAYMENT_RECONCILIATION_REQUIRED
      ? {
          alertLabel: 'Payment Alert',
          eyebrow: 'Payment Reconciliation Required',
          heading: 'A PayPal payment row needs review',
          intro:
            'PayPal and the local ledger may be out of sync. Review the payment state before fulfillment, refund, or customer follow-up decisions.',
          buttonLabel: 'Open Payment Detail',
          footnote:
            'This is an internal payment operations alert. Do not recapture or fulfill until PayPal capture status is verified.',
        }
      : {}),
  };

  const result = await db.adminNotificationOutbox.createMany({
    data: recipients.map((recipient) => ({
      orderToken,
      paypalOrderId,
      type,
      stage,
      errorCode,
      severity,
      status: ADMIN_NOTIFICATION_STATUS.PENDING,
      dedupeKey: buildNotificationDedupeKey({
        orderToken,
        recipient,
        type,
        stage,
        errorCode,
      }),
      recipient,
      payload,
    })),
    skipDuplicates: true,
  });

  return { created: result.count, skipped: false as const };
}

export async function enqueueAdminPaymentReconciliationNotification({
  severity = ADMIN_NOTIFICATION_SEVERITY.CRITICAL,
  ...props
}: EnqueueAdminPaymentReconciliationNotificationProps) {
  return enqueueAdminRecoveryNotification({
    ...props,
    type: ADMIN_NOTIFICATION_TYPE.PAYMENT_RECONCILIATION_REQUIRED,
    stage: ADMIN_NOTIFICATION_STAGE.PAYMENT,
    severity,
    recipientGroupKey: ADMIN_NOTIFICATION_RECIPIENT_GROUP_KEY.PAYMENT_ISSUES,
  });
}

export async function enqueueAdminPayPalLedgerWebhookDriftNotification({
  activationSource,
  dbWebhookId,
  envVarName,
  envWebhookId,
  label,
  message,
  severity = ADMIN_NOTIFICATION_SEVERITY.WARNING,
  syncStatus,
}: EnqueueAdminPayPalLedgerWebhookDriftNotificationProps) {
  const recipients = await resolveAdminNotificationRecipients({
    groupKey: ADMIN_NOTIFICATION_RECIPIENT_GROUP_KEY.PAYPAL_LEDGER_WEBHOOK_OPERATIONS,
    fallbackEmails: getConfiguredAdminRecipients(),
  });

  if (recipients.length === 0) {
    return { created: 0, dedupeBase: null, skipped: true as const };
  }

  const dashboardUrl = buildAdminPayPalLedgerWebhooksUrl();
  const supportReference = envVarName;
  const payload: AdminPayPalLedgerWebhookDriftNotificationPayload = {
    activationSource,
    dashboardUrl,
    dbWebhookId,
    envVarName,
    envWebhookId,
    label,
    message,
    supportReference,
    syncStatus,
  };
  const dedupeBase = buildGenericNotificationDedupeKey([
    ADMIN_NOTIFICATION_TYPE.PAYPAL_LEDGER_WEBHOOK_DRIFT,
    ADMIN_NOTIFICATION_STAGE.WEBHOOK,
    envVarName,
    syncStatus,
    dbWebhookId || 'no_db_id',
    envWebhookId || 'no_env_id',
  ]);

  const result = await paypalTxLedger.adminNotificationOutbox.createMany({
    data: recipients.map((recipient) => ({
      orderToken: null,
      paypalOrderId: null,
      type: ADMIN_NOTIFICATION_TYPE.PAYPAL_LEDGER_WEBHOOK_DRIFT,
      stage: ADMIN_NOTIFICATION_STAGE.WEBHOOK,
      errorCode: 'WEBHOOK_ENV_DB_DRIFT',
      severity,
      status: ADMIN_NOTIFICATION_STATUS.PENDING,
      dedupeKey: `${dedupeBase}:${recipient}`,
      recipient,
      payload,
    })),
    skipDuplicates: true,
  });

  return { created: result.count, dedupeBase, skipped: false as const };
}

export async function enqueueAdminFulfillmentPushAcceptedNotification({
  db = paypalTxLedger,
  orderToken,
  paypalOrderId,
  customerName,
  customerEmail,
  receiptLink,
  merchizeExternalOrderNumber,
  merchizeOrderId,
  merchizeOrderCode,
}: EnqueueAdminFulfillmentPushAcceptedNotificationProps) {
  const type = ADMIN_NOTIFICATION_TYPE.PAID_ORDER_FULFILLMENT_PUSH_ACCEPTED;
  const stage = ADMIN_NOTIFICATION_STAGE.FULFILLMENT;
  const severity = ADMIN_NOTIFICATION_SEVERITY.INFO;
  const recipients = await resolveAdminNotificationRecipients({
    groupKey: ADMIN_NOTIFICATION_RECIPIENT_GROUP_KEY.PAID_ORDER_FULFILLMENT_SUCCESS,
    fallbackEmails: getConfiguredAdminRecipients(),
  });

  if (recipients.length === 0) {
    return { created: 0, skipped: true as const };
  }

  const payload: AdminFulfillmentPushAcceptedNotificationPayload = {
    orderToken,
    paypalOrderId,
    customerName,
    customerEmail,
    receiptLink,
    supportReference: orderToken,
    merchizeExternalOrderNumber,
    merchizeOrderId,
    merchizeOrderCode,
    adminDetailUrl: buildAdminOrderRecoveryUrl(orderToken),
  };

  const result = await db.adminNotificationOutbox.createMany({
    data: recipients.map((recipient) => ({
      orderToken,
      paypalOrderId,
      type,
      stage,
      errorCode: 'PUSH_ACCEPTED',
      severity,
      status: ADMIN_NOTIFICATION_STATUS.PENDING,
      dedupeKey: buildNotificationDedupeKey({
        orderToken,
        recipient,
        type,
        stage,
        errorCode: 'PUSH_ACCEPTED',
      }),
      recipient,
      payload,
    })),
    skipDuplicates: true,
  });

  return { created: result.count, skipped: false as const };
}

export async function listAdminNotificationsForOrder(orderToken: string) {
  return paypalTxLedger.adminNotificationOutbox.findMany({
    where: { orderToken },
    orderBy: { createdAt: 'desc' },
  });
}

async function sendAdminRecoveryNotificationRow(
  row: Awaited<ReturnType<typeof paypalTxLedger.adminNotificationOutbox.findFirst>>,
) {
  if (!row) {
    return { id: null, ok: false as const, error: 'Notification row was not found.' };
  }

  if (!row.recipient) {
    await paypalTxLedger.adminNotificationOutbox.update({
      where: { id: row.id },
      data: {
        status: ADMIN_NOTIFICATION_STATUS.FAILED,
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        lastErrorMessage: 'Notification row is missing a recipient email.',
      },
    });

    return { id: row.id, ok: false as const, error: 'Missing recipient email.' };
  }

  const isPushAccepted = row.type === ADMIN_NOTIFICATION_TYPE.PAID_ORDER_FULFILLMENT_PUSH_ACCEPTED;
  const isPaymentReconciliation =
    row.type === ADMIN_NOTIFICATION_TYPE.PAYMENT_RECONCILIATION_REQUIRED;
  const isPayPalLedgerWebhookDrift =
    row.type === ADMIN_NOTIFICATION_TYPE.PAYPAL_LEDGER_WEBHOOK_DRIFT;

  try {
    const { sendMailFromPrimaryAgent } = await import('@/lib/zeptomail/sendMailFromPrimaryAgent');
    const subject = isPushAccepted
      ? `Paid order pushed to fulfillment · ${(row.payload as AdminFulfillmentPushAcceptedNotificationPayload).supportReference.slice(0, 8)}`
      : isPayPalLedgerWebhookDrift
        ? `PayPal ledger webhook env drift · ${(row.payload as AdminPayPalLedgerWebhookDriftNotificationPayload).envVarName}`
        : isPaymentReconciliation
          ? `Payment reconciliation required · ${(row.payload as AdminRecoveryNotificationPayload).supportReference}`
          : `Paid order recovery required · ${(row.payload as AdminRecoveryNotificationPayload).supportReference}`;
    const htmlbody = isPushAccepted
      ? buildAdminFulfillmentPushAcceptedEmailHtml(
          row.payload as AdminFulfillmentPushAcceptedNotificationPayload,
        )
      : isPayPalLedgerWebhookDrift
        ? buildAdminPayPalLedgerWebhookDriftEmailHtml(
            row.payload as AdminPayPalLedgerWebhookDriftNotificationPayload,
          )
        : buildAdminRecoveryAlertEmailHtml(row.payload as AdminRecoveryNotificationPayload);

    await sendMailFromPrimaryAgent({
      emailReceipents: [
        {
          email_address: {
            address: row.recipient,
            name: 'Codex Christi Operations',
          },
        },
      ],
      subject,
      htmlbody,
    });

    await paypalTxLedger.adminNotificationOutbox.update({
      where: { id: row.id },
      data: {
        status: ADMIN_NOTIFICATION_STATUS.SENT,
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        sentAt: new Date(),
        lastErrorMessage: null,
      },
    });

    return { id: row.id, ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error);

    await paypalTxLedger.adminNotificationOutbox.update({
      where: { id: row.id },
      data: {
        status: ADMIN_NOTIFICATION_STATUS.FAILED,
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        lastErrorMessage: message,
      },
    });

    return { id: row.id, ok: false as const, error: message };
  }
}

export async function sendPendingAdminRecoveryNotifications(limit = DEFAULT_PENDING_SEND_LIMIT) {
  const rows = await paypalTxLedger.adminNotificationOutbox.findMany({
    where: {
      status: {
        in: [ADMIN_NOTIFICATION_STATUS.PENDING, ADMIN_NOTIFICATION_STATUS.FAILED],
      },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  const results = [];

  for (const row of rows) {
    results.push(await sendAdminRecoveryNotificationRow(row));
  }

  return results;
}

export async function sendPendingAdminNotificationsByDedupePrefix({
  dedupePrefix,
  limit = DEFAULT_PENDING_SEND_LIMIT,
}: {
  dedupePrefix: string;
  limit?: number;
}) {
  const rows = await paypalTxLedger.adminNotificationOutbox.findMany({
    where: {
      dedupeKey: {
        startsWith: `${dedupePrefix}:`,
      },
      status: {
        in: [ADMIN_NOTIFICATION_STATUS.PENDING, ADMIN_NOTIFICATION_STATUS.FAILED],
      },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  const results = [];

  for (const row of rows) {
    results.push(await sendAdminRecoveryNotificationRow(row));
  }

  return results;
}

export async function sendPendingAdminRecoveryNotificationsForOrder(orderToken: string) {
  const rows = await paypalTxLedger.adminNotificationOutbox.findMany({
    where: {
      orderToken,
      status: {
        in: [ADMIN_NOTIFICATION_STATUS.PENDING, ADMIN_NOTIFICATION_STATUS.FAILED],
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const results = [];

  for (const row of rows) {
    results.push(await sendAdminRecoveryNotificationRow(row));
  }

  return results;
}

export async function resendAdminRecoveryNotification(id: string) {
  const row = await paypalTxLedger.adminNotificationOutbox.update({
    where: { id },
    data: {
      status: ADMIN_NOTIFICATION_STATUS.PENDING,
      lastErrorMessage: null,
    },
  });

  return sendAdminRecoveryNotificationRow(row);
}

export async function suppressAdminRecoveryNotification(id: string) {
  return paypalTxLedger.adminNotificationOutbox.update({
    where: { id },
    data: {
      status: ADMIN_NOTIFICATION_STATUS.SUPPRESSED,
      lastErrorMessage: null,
    },
  });
}

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
  PAID_ORDER_RECOVERY_SCANNER_CANDIDATE: 'paid_order_recovery_scanner_candidate',
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

type AdminEmailTone = 'amber' | 'cyan' | 'emerald' | 'rose';

type AdminEmailDetailItem = {
  label: string;
  valueHtml: string;
  valueColor?: string;
  monospace?: boolean;
};

type AdminEmailShellProps = {
  tone: AdminEmailTone;
  alertLabel: string;
  eyebrow: string;
  heading: string;
  intro: string;
  bodyHtml: string;
  buttonHref: string;
  buttonLabel: string;
  footnote?: string | null;
};

function getAdminEmailTone(tone: AdminEmailTone) {
  const tones = {
    amber: {
      accent: '#fbbf24',
      accentSoft: '#fde68a',
      accentMuted: '#fcd34d',
      border: 'rgba(251,191,36,0.28)',
      glow: 'rgba(251,191,36,0.12)',
      buttonBg: '#fbbf24',
      buttonText: '#111827',
    },
    cyan: {
      accent: '#67e8f9',
      accentSoft: '#bae6fd',
      accentMuted: '#7dd3fc',
      border: 'rgba(103,232,249,0.24)',
      glow: 'rgba(14,165,233,0.14)',
      buttonBg: '#dbeafe',
      buttonText: '#082f49',
    },
    emerald: {
      accent: '#34d399',
      accentSoft: '#d1fae5',
      accentMuted: '#6ee7b7',
      border: 'rgba(52,211,153,0.24)',
      glow: 'rgba(16,185,129,0.13)',
      buttonBg: '#d1fae5',
      buttonText: '#064e3b',
    },
    rose: {
      accent: '#fb7185',
      accentSoft: '#fecdd3',
      accentMuted: '#fda4af',
      border: 'rgba(251,113,133,0.26)',
      glow: 'rgba(244,63,94,0.13)',
      buttonBg: '#fecdd3',
      buttonText: '#881337',
    },
  } satisfies Record<AdminEmailTone, Record<string, string>>;

  return tones[tone];
}

function buildAdminEmailShell({
  tone,
  alertLabel,
  eyebrow,
  heading,
  intro,
  bodyHtml,
  buttonHref,
  buttonLabel,
  footnote,
}: AdminEmailShellProps) {
  const logoUrl = getMainSiteUrl('/media/img/general/logo-glow-tiny.jpg');
  const ambientUrl = getMainSiteUrl('/media/img/admin/ambient/ambient-03-desktop.avif');
  const cometsUrl = getMainSiteUrl('/media/img/home/comets_%20desktop.svg');
  const colors = getAdminEmailTone(tone);
  const safeFootnote =
    footnote ??
    'This is an internal operations alert. Review the durable ledger and provider state before taking action.';

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#030712;color:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#030712;background-image:linear-gradient(180deg,rgba(3,7,18,0.82),rgba(3,7,18,0.95)),url('${escapeHtml(ambientUrl)}');background-position:center;background-size:cover;padding:30px 14px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:720px;border-collapse:separate;">
            <tr>
              <td style="padding:0 0 18px;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="${escapeHtml(logoUrl)}" width="52" height="52" alt="Codex Christi" style="border-radius:16px;border:1px solid rgba(255,255,255,0.18);vertical-align:middle;box-shadow:0 0 34px rgba(125,211,252,0.16);" />
                      <span style="display:inline-block;margin-left:13px;font-size:12px;letter-spacing:0.25em;text-transform:uppercase;color:#dbeafe;vertical-align:middle;">Codex Christi Ops</span>
                    </td>
                    <td align="right" style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${colors.accent};font-weight:700;vertical-align:middle;">
                      ${escapeHtml(alertLabel)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="border:1px solid ${colors.border};border-radius:24px;background:#07111f;background-image:linear-gradient(145deg,rgba(76,61,61,0.24),rgba(15,23,42,0.52) 56%,rgba(8,15,30,0.68)),url('${escapeHtml(cometsUrl)}');background-repeat:repeat;background-size:auto,560px auto;padding:1px;box-shadow:0 26px 72px rgba(0,0,0,0.42),0 0 44px ${colors.glow};">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:separate;border-radius:23px;background:#07111f;background-image:linear-gradient(180deg,rgba(7,17,31,0.92),rgba(7,17,31,0.84));overflow:hidden;">
                  <tr>
                    <td style="padding:30px 28px 28px;">
                      <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:${colors.accentSoft};font-weight:800;">${escapeHtml(eyebrow)}</div>
                      <h1 style="margin:13px 0 10px;font-size:26px;line-height:1.22;color:#ffffff;">${escapeHtml(heading)}</h1>
                      <p style="margin:0 0 24px;font-size:14px;line-height:1.72;color:#cbd5e1;">
                        ${escapeHtml(intro)}
                      </p>

                      ${bodyHtml}

                      <div style="margin-top:24px;">
                        <a href="${escapeHtml(buttonHref)}" style="display:inline-block;border-radius:14px;background:${colors.buttonBg};color:${colors.buttonText};text-decoration:none;font-size:13px;font-weight:800;padding:13px 19px;box-shadow:0 16px 34px rgba(0,0,0,0.24);">${escapeHtml(buttonLabel)}</a>
                      </div>

                      <p style="margin:22px 0 0;font-size:12px;line-height:1.7;color:#94a3b8;">
                        ${escapeHtml(safeFootnote)}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildAdminEmailDetailGrid(items: AdminEmailDetailItem[]) {
  const rows: string[] = [];

  for (let index = 0; index < items.length; index += 2) {
    const left = items[index];
    const right = items[index + 1];
    const cells = [left, right].map((item) =>
      item
        ? `
          <td width="50%" style="padding:16px 18px;vertical-align:top;border-top:${index === 0 ? '0' : '1px solid rgba(148,163,184,0.14)'};">
            <div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#94a3b8;">${escapeHtml(item.label)}</div>
            <div style="margin-top:9px;color:${item.valueColor ?? '#e2e8f0'};font-size:14px;line-height:1.52;word-break:break-word;${item.monospace ? 'font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;' : ''}">
              ${item.valueHtml}
            </div>
          </td>`
        : '<td width="50%" style="padding:16px 18px;border-top:1px solid rgba(148,163,184,0.14);">&nbsp;</td>',
    );

    rows.push(`<tr>${cells.join('')}</tr>`);
  }

  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 22px;border:1px solid rgba(255,255,255,0.10);border-radius:18px;background:#0a1424;background-image:linear-gradient(145deg,rgba(255,255,255,0.06),rgba(15,23,42,0.20));overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,0.06);">
      ${rows.join('')}
    </table>`;
}

function buildAdminEmailIssueList(label: string, issues: string[], tone: AdminEmailTone) {
  const colors = getAdminEmailTone(tone);
  const issueRows = issues
    .map(
      (issue) => `
        <tr>
          <td style="padding:12px 0;border-top:1px solid rgba(148,163,184,0.16);color:#bfdbfe;font-size:13px;line-height:1.55;">
            ${escapeHtml(issue)}
          </td>
        </tr>`,
    )
    .join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 22px;">
      <tr>
        <td style="padding:0 0 8px;color:${colors.accentMuted};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;font-weight:700;">${escapeHtml(label)}</td>
      </tr>
      ${issueRows}
    </table>`;
}

function buildAdminRecoveryAlertEmailHtml(payload: AdminRecoveryNotificationPayload) {
  const tone: AdminEmailTone = payload.alertLabel === 'Payment Alert' ? 'amber' : 'cyan';
  const bodyHtml = `
    ${buildAdminEmailDetailGrid([
      {
        label: 'Customer',
        valueHtml: `${escapeHtml(payload.customerName)}<br /><span style="color:#93c5fd;">${escapeHtml(payload.customerEmail)}</span>`,
      },
      {
        label: 'Ledger Status',
        valueHtml: escapeHtml(payload.ledgerStatus.replaceAll('_', ' ')),
        valueColor: '#fbbf24',
      },
      {
        label: 'Support Ref',
        valueHtml: escapeHtml(payload.supportReference),
        monospace: true,
      },
      {
        label: 'Error Code',
        valueHtml: escapeHtml(payload.errorCode),
        valueColor: '#fca5a5',
        monospace: true,
      },
    ])}
    ${buildAdminEmailIssueList('What failed', payload.issueSummary, tone)}`;

  return buildAdminEmailShell({
    tone,
    alertLabel: payload.alertLabel ?? 'Recovery Alert',
    eyebrow: payload.eyebrow ?? 'Paid Order Requires Attention',
    heading: payload.heading ?? 'A paid checkout stopped during fulfillment',
    intro:
      payload.intro ??
      'This order is already paid, but the fulfillment stage did not complete cleanly. Review the transaction before the customer needs to contact support.',
    bodyHtml,
    buttonHref: payload.adminDetailUrl,
    buttonLabel: payload.buttonLabel ?? 'Open Recovery Detail',
    footnote:
      payload.footnote ??
      'This is an internal operations alert. The customer has already paid; treat this as a recovery task, not a failed checkout attempt.',
  });
}

function buildAdminFulfillmentPushAcceptedEmailHtml(
  payload: AdminFulfillmentPushAcceptedNotificationPayload,
) {
  const bodyHtml = buildAdminEmailDetailGrid([
    {
      label: 'Customer',
      valueHtml: `${escapeHtml(payload.customerName)}<br /><span style="color:#93c5fd;">${escapeHtml(payload.customerEmail)}</span>`,
    },
    {
      label: 'Support Ref',
      valueHtml: escapeHtml(payload.supportReference),
      monospace: true,
    },
    {
      label: 'Merchize External Number',
      valueHtml: escapeHtml(payload.merchizeExternalOrderNumber ?? 'Unavailable'),
      valueColor: '#d1fae5',
      monospace: true,
    },
    {
      label: 'Merchize Order ID',
      valueHtml: escapeHtml(payload.merchizeOrderId ?? payload.merchizeOrderCode ?? 'Unavailable'),
      valueColor: '#d1fae5',
      monospace: true,
    },
  ]);

  return buildAdminEmailShell({
    tone: 'emerald',
    alertLabel: 'Fulfillment Ready',
    eyebrow: 'Fulfillment Push Accepted',
    heading: 'A paid order moved to fulfillment',
    intro:
      'Payment, receipt, Django payment save, Django fulfillment processing, provider detail sync, and Merchize push-to-fulfillment completed.',
    bodyHtml,
    buttonHref: payload.adminDetailUrl,
    buttonLabel: 'Open Order Detail',
    footnote:
      'This is an internal success notice. Customer notification delivery is tracked separately in the customer notification outbox.',
  });
}

function buildAdminPayPalLedgerWebhookDriftEmailHtml(
  payload: AdminPayPalLedgerWebhookDriftNotificationPayload,
) {
  const dbValue = payload.dbWebhookId?.trim() || 'not set';
  const envValue = payload.envWebhookId?.trim() || 'not set';
  const bodyHtml = buildAdminEmailDetailGrid([
    {
      label: 'Binding',
      valueHtml: escapeHtml(payload.label),
    },
    {
      label: 'Activation Source',
      valueHtml: escapeHtml(payload.activationSource),
      valueColor: '#fbbf24',
    },
    {
      label: 'Env Variable',
      valueHtml: escapeHtml(payload.envVarName),
      valueColor: '#bae6fd',
      monospace: true,
    },
    {
      label: 'Sync Status',
      valueHtml: escapeHtml(payload.syncStatus),
      monospace: true,
    },
    {
      label: 'DB Webhook ID',
      valueHtml: escapeHtml(dbValue),
      monospace: true,
    },
    {
      label: 'Runtime Env ID',
      valueHtml: escapeHtml(envValue),
      monospace: true,
    },
  ]);

  return buildAdminEmailShell({
    tone: 'amber',
    alertLabel: 'Webhook Alert',
    eyebrow: 'PayPal Ledger Webhook Operations',
    heading: 'Webhook env drift needs review',
    intro: payload.message,
    bodyHtml,
    buttonHref: payload.dashboardUrl,
    buttonLabel: 'Open Webhook Dashboard',
    footnote:
      'Update the deployment environment when the DB value is the intended trusted webhook ID. Hybrid mode keeps env fallback available for break-glass verification.',
  });
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

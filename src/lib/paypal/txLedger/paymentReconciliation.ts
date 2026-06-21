import 'server-only';

import { OrdersController, PaymentsController } from '@paypal/paypal-server-sdk';
import { formatDistanceToNowStrict } from 'date-fns';
import { getPayPalClient } from '@/lib/paymentClients/paypalClient';
import {
  ADMIN_NOTIFICATION_SEVERITY,
  enqueueAdminPaymentReconciliationNotification,
  sendPendingAdminRecoveryNotificationsForOrder,
} from '@/lib/paypal/txLedger/adminNotificationOutbox';
import { getPayPalCaptureCompletion } from '@/lib/paypal/txLedger/captureCompletion';
import {
  getRecoveryScannerBatchSize,
  getRecoveryScannerMinAgeMinutes,
  isRecoveryScannerEnabled,
} from '@/lib/paypal/txLedger/processingPolicy';
import { runPaidFulfillmentProcessing } from '@/lib/paypal/txLedger/runPaidFulfillmentProcessing';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';

const DEFAULT_MIN_AGE_MINUTES = 15;
const DEFAULT_BATCH_SIZE = 5;
const MAX_BATCH_SIZE = 25;

const PAYMENT_ATTENTION_STATUSES = new Set<string>([
  PAYPAL_LEDGER_STATUS.AUTHORIZED,
  PAYPAL_LEDGER_STATUS.PENDING,
  PAYPAL_LEDGER_STATUS.ERROR,
]);

const PAYMENT_RECONCILIATION_ERROR_CODES = new Set<string>([
  'AUTHORIZE_FAILED',
  'AUTHORIZE_PERSIST_FAILED',
  'AUTHORIZE_RESYNC_FAILED',
  'CAPTURE_FAILED',
  'CAPTURE_NOT_COMPLETED',
  'CAPTURE_PERSIST_FAILED',
  'PAYPAL_AUTHORIZATION_CAPTURED_WITHOUT_CAPTURE_PAYLOAD',
  'PAYPAL_AUTHORIZATION_DENIED',
  'PAYPAL_AUTHORIZATION_EXPIRED',
  'PAYPAL_AUTHORIZATION_RECONCILIATION_REQUIRED',
  'PAYPAL_AUTHORIZATION_STILL_OPEN',
  'PAYPAL_AUTHORIZATION_VOIDED',
  'PAYPAL_CAPTURE_RECONCILIATION_REQUIRED',
  'PAYPAL_PAYMENT_REFERENCE_MISSING',
]);

type JsonRecord = Record<string, unknown>;

type PaymentLedgerRow = {
  orderToken: string;
  paypalOrderId: string | null;
  paypalAuthorizationId: string | null;
  customerName: string;
  customerEmail: string;
  initialCurrency: string | null;
  authorizePayload: unknown;
  capturePayload: unknown;
  status: string;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  processingCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PayPalPaymentReconciliationRow = {
  orderToken: string;
  supportRef: string;
  customer: string;
  status: string;
  paypalOrderId: string | null;
  paypalAuthorizationId: string | null;
  captureId: string | null;
  amount: string;
  reason: string;
  recommendedAction: string;
  risk: 'critical' | 'warning' | 'info';
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  updated: string;
  createdAt: string;
  updatedAt: string;
};

export type PayPalPaymentReconciliationResult = {
  orderToken: string;
  ok: boolean;
  action: string;
  previousStatus: string;
  status: string | null;
  message: string;
  captureId: string | null;
  authorizationStatus: string | null;
  notificationCreated: number;
};

export type PayPalPaymentReconciliationRunResult = {
  ok: boolean;
  enabled: boolean;
  dryRun: boolean;
  minAgeMinutes: number;
  batchSize: number;
  scannedAt: string;
  candidates: PayPalPaymentReconciliationRow[];
  results: PayPalPaymentReconciliationResult[];
  skipped: Array<{
    orderToken: string;
    reason: string;
  }>;
};

export type PayPalPaymentReconciliationDashboard = {
  rows: PayPalPaymentReconciliationRow[];
  total: number;
  critical: number;
  warning: number;
  info: number;
  generatedAt: string;
  minAgeMinutes: number;
  batchSize: number;
  enabled: boolean;
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getPath(root: unknown, path: Array<string | number>) {
  return path.reduce<unknown>((current, key) => {
    if (typeof key === 'number') return Array.isArray(current) ? current[key] : undefined;
    return asRecord(current)?.[key];
  }, root);
}

function getNestedCapture(payload: unknown) {
  const capturePaths = [
    ['purchaseUnits', 0, 'payments', 'captures', 0],
    ['purchase_units', 0, 'payments', 'captures', 0],
  ];

  for (const path of capturePaths) {
    const capture = asRecord(getPath(payload, path));
    if (capture) return capture;
  }

  return null;
}

function getNestedAuthorizationId(payload: unknown) {
  return (
    asString(getPath(payload, ['purchaseUnits', 0, 'payments', 'authorizations', 0, 'id'])) ??
    asString(getPath(payload, ['purchase_units', 0, 'payments', 'authorizations', 0, 'id']))
  );
}

function safeJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

function clampBatchSize(batchSize: number) {
  return Math.min(Math.max(batchSize, 1), MAX_BATCH_SIZE);
}

function getScannerMinAgeMinutes() {
  try {
    return getRecoveryScannerMinAgeMinutes();
  } catch {
    return DEFAULT_MIN_AGE_MINUTES;
  }
}

function getScannerBatchSize() {
  try {
    return getRecoveryScannerBatchSize();
  } catch {
    return DEFAULT_BATCH_SIZE;
  }
}

function getScannerEnabled() {
  try {
    return isRecoveryScannerEnabled();
  } catch {
    return false;
  }
}

function getCaptureAmountLabel(row: PaymentLedgerRow) {
  const completion = getPayPalCaptureCompletion(row.capturePayload);

  if (completion.amount) {
    return `${completion.amount.value} ${completion.amount.currency}`;
  }

  const authAmount = asRecord(getPath(row.authorizePayload, ['purchaseUnits', 0, 'amount']));
  const value = asString(authAmount?.value);
  const currency = asString(authAmount?.currencyCode) ?? asString(authAmount?.currency_code);

  if (value && currency) return `${value} ${currency}`;
  return row.initialCurrency ? `— ${row.initialCurrency}` : '—';
}

function hasPaymentEvidence(row: PaymentLedgerRow) {
  return Boolean(
    row.paypalAuthorizationId ||
    row.capturePayload ||
    (row.lastErrorCode && PAYMENT_RECONCILIATION_ERROR_CODES.has(row.lastErrorCode)),
  );
}

function getLocalReason(row: PaymentLedgerRow) {
  const completion = getPayPalCaptureCompletion(row.capturePayload);

  if (completion.captureId && !completion.ok) {
    return completion.reason;
  }

  if (row.paypalAuthorizationId && !completion.ok) {
    return 'PayPal authorization exists, but the ledger does not contain a verified completed capture.';
  }

  if (row.lastErrorCode && PAYMENT_RECONCILIATION_ERROR_CODES.has(row.lastErrorCode)) {
    return (
      row.lastErrorMessage ?? `Payment-stage error ${row.lastErrorCode} requires reconciliation.`
    );
  }

  return 'Ledger payment state is stale and needs PayPal verification.';
}

function getRecommendedAction(row: PaymentLedgerRow) {
  const completion = getPayPalCaptureCompletion(row.capturePayload);

  if (completion.captureId && !completion.ok) {
    return 'Check capture status with PayPal and block fulfillment until capture is completed.';
  }

  if (row.paypalAuthorizationId) {
    return 'Check authorization status with PayPal before capture, reauthorization, or customer follow-up.';
  }

  return 'Load PayPal order state and determine whether authorization or capture succeeded.';
}

function getRisk(row: PaymentLedgerRow): PayPalPaymentReconciliationRow['risk'] {
  const ageMs = Date.now() - row.updatedAt.getTime();
  const ageHours = ageMs / 3_600_000;

  if (
    row.lastErrorCode === 'CAPTURE_PERSIST_FAILED' ||
    row.lastErrorCode === 'CAPTURE_NOT_COMPLETED' ||
    ageHours >= 24
  ) {
    return 'critical';
  }

  if (row.paypalAuthorizationId || row.capturePayload) return 'warning';
  return 'info';
}

function mapRow(row: PaymentLedgerRow): PayPalPaymentReconciliationRow {
  const completion = getPayPalCaptureCompletion(row.capturePayload);

  return {
    orderToken: row.orderToken,
    supportRef: row.orderToken.slice(0, 8).toUpperCase(),
    customer: row.customerEmail || row.customerName,
    status: row.status,
    paypalOrderId: row.paypalOrderId,
    paypalAuthorizationId: row.paypalAuthorizationId,
    captureId: completion.captureId,
    amount: getCaptureAmountLabel(row),
    reason: getLocalReason(row),
    recommendedAction: getRecommendedAction(row),
    risk: getRisk(row),
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
    updated: formatDistanceToNowStrict(row.updatedAt, { addSuffix: true }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function isPaymentReconciliationCandidate(row: PaymentLedgerRow) {
  if (row.processingCompletedAt) return false;
  if (!hasPaymentEvidence(row)) return false;
  if (getPayPalCaptureCompletion(row.capturePayload).ok) return false;

  return (
    PAYMENT_ATTENTION_STATUSES.has(row.status) ||
    Boolean(row.lastErrorCode && PAYMENT_RECONCILIATION_ERROR_CODES.has(row.lastErrorCode))
  );
}

async function queryPotentialPaymentRows({
  batchSize,
  minAgeMinutes,
  now,
  orderTokens,
}: {
  batchSize: number;
  minAgeMinutes: number;
  now: Date;
  orderTokens?: string[];
}) {
  const cutoff = new Date(now.getTime() - minAgeMinutes * 60_000);

  return paypalTxLedger.paypalIntent.findMany({
    where: {
      ...(orderTokens?.length ? { orderToken: { in: orderTokens } } : {}),
      processingCompletedAt: null,
      updatedAt: { lte: cutoff },
      OR: [
        { paypalAuthorizationId: { not: null } },
        { status: { in: [...PAYMENT_ATTENTION_STATUSES] } },
        { lastErrorCode: { in: [...PAYMENT_RECONCILIATION_ERROR_CODES] } },
      ],
    },
    orderBy: [{ updatedAt: 'asc' }, { createdAt: 'asc' }],
    take: batchSize * 5,
    select: {
      orderToken: true,
      paypalOrderId: true,
      paypalAuthorizationId: true,
      customerName: true,
      customerEmail: true,
      initialCurrency: true,
      authorizePayload: true,
      capturePayload: true,
      status: true,
      lastErrorCode: true,
      lastErrorMessage: true,
      processingCompletedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function findPayPalPaymentReconciliationRows(args?: {
  batchSize?: number;
  minAgeMinutes?: number;
  now?: Date;
  orderTokens?: string[];
}) {
  const now = args?.now ?? new Date();
  const minAgeMinutes = args?.minAgeMinutes ?? getScannerMinAgeMinutes();
  const batchSize = clampBatchSize(args?.batchSize ?? getScannerBatchSize());
  const orderTokens = args?.orderTokens?.map((token) => token.trim()).filter(Boolean);
  const rows = await queryPotentialPaymentRows({
    batchSize,
    minAgeMinutes,
    now,
    orderTokens,
  });

  return rows
    .filter(isPaymentReconciliationCandidate)
    .slice(0, batchSize)
    .map((row) => mapRow(row));
}

export async function getPayPalPaymentReconciliationDashboard(): Promise<PayPalPaymentReconciliationDashboard> {
  const minAgeMinutes = getScannerMinAgeMinutes();
  const batchSize = getScannerBatchSize();
  const rows = await findPayPalPaymentReconciliationRows({
    batchSize: Math.max(batchSize, 25),
    minAgeMinutes,
  });

  return {
    rows,
    total: rows.length,
    critical: rows.filter((row) => row.risk === 'critical').length,
    warning: rows.filter((row) => row.risk === 'warning').length,
    info: rows.filter((row) => row.risk === 'info').length,
    generatedAt: new Date().toISOString(),
    minAgeMinutes,
    batchSize,
    enabled: getScannerEnabled(),
  };
}

export async function getPayPalPaymentReconciliationDashboardSummary() {
  const dashboard = await getPayPalPaymentReconciliationDashboard();

  return {
    total: dashboard.total,
    critical: dashboard.critical,
    warning: dashboard.warning,
  };
}

async function enqueuePaymentAttention({
  row,
  errorCode,
  errorMessage,
  issueSummary,
  severity,
}: {
  row: PaymentLedgerRow;
  errorCode: string;
  errorMessage: string;
  issueSummary?: string[];
  severity?: (typeof ADMIN_NOTIFICATION_SEVERITY)[keyof typeof ADMIN_NOTIFICATION_SEVERITY];
}) {
  const notification = await enqueueAdminPaymentReconciliationNotification({
    orderToken: row.orderToken,
    paypalOrderId: row.paypalOrderId,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    ledgerStatus: row.status,
    errorCode,
    errorMessage,
    issueSummary,
    receiptLink: null,
    severity,
  });

  await sendPendingAdminRecoveryNotificationsForOrder(row.orderToken).catch((error) => {
    console.error('[paypal.payment_reconciliation.notification_send_failed]', {
      orderToken: row.orderToken,
      error: error instanceof Error ? error.message : String(error),
    });
  });

  return notification;
}

function getLedgerStatusForIncompleteCapture(status: string | null) {
  if (status === 'PENDING') return PAYPAL_LEDGER_STATUS.PENDING;
  if (status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED')
    return PAYPAL_LEDGER_STATUS.REFUNDED;

  return PAYPAL_LEDGER_STATUS.ERROR;
}

async function handleCapturedPayment({
  row,
  payload,
}: {
  row: PaymentLedgerRow;
  payload: unknown;
}): Promise<PayPalPaymentReconciliationResult> {
  const completion = getPayPalCaptureCompletion(payload);

  if (!completion.ok) {
    await paypalTxLedger.paypalIntent.update({
      where: { orderToken: row.orderToken },
      data: {
        status: getLedgerStatusForIncompleteCapture(completion.status),
        capturePayload: safeJson(payload),
        lastErrorCode: 'CAPTURE_NOT_COMPLETED',
        lastErrorMessage: completion.reason,
      },
    });

    const notification = await enqueuePaymentAttention({
      row,
      errorCode: 'CAPTURE_NOT_COMPLETED',
      errorMessage: completion.reason,
      issueSummary: [
        completion.reason,
        'Fulfillment remains blocked until PayPal capture is completed.',
      ],
      severity: ADMIN_NOTIFICATION_SEVERITY.CRITICAL,
    });

    return {
      orderToken: row.orderToken,
      ok: false,
      action: 'capture_checked_incomplete',
      previousStatus: row.status,
      status: getLedgerStatusForIncompleteCapture(completion.status),
      message: completion.reason,
      captureId: completion.captureId,
      authorizationStatus: null,
      notificationCreated: notification.created,
    };
  }

  await paypalTxLedger.paypalIntent.update({
    where: { orderToken: row.orderToken },
    data: {
      status: PAYPAL_LEDGER_STATUS.CAPTURED,
      capturePayload: safeJson(payload),
      lastErrorCode: null,
      lastErrorMessage: null,
    },
  });

  const notification = await enqueuePaymentAttention({
    row,
    errorCode: 'PAYPAL_CAPTURE_RECONCILED',
    errorMessage: completion.reason,
    issueSummary: [
      completion.reason,
      'Ledger capture payload was refreshed from PayPal.',
      'Server-side fulfillment processing was resumed.',
    ],
    severity: ADMIN_NOTIFICATION_SEVERITY.WARNING,
  });

  try {
    await runPaidFulfillmentProcessing(row.orderToken);

    return {
      orderToken: row.orderToken,
      ok: true,
      action: 'capture_reconciled_and_fulfillment_resumed',
      previousStatus: row.status,
      status: PAYPAL_LEDGER_STATUS.CAPTURED,
      message: completion.reason,
      captureId: completion.captureId,
      authorizationStatus: null,
      notificationCreated: notification.created,
    };
  } catch (error) {
    return {
      orderToken: row.orderToken,
      ok: false,
      action: 'capture_reconciled_fulfillment_failed',
      previousStatus: row.status,
      status: PAYPAL_LEDGER_STATUS.CAPTURED,
      message: error instanceof Error ? error.message : String(error),
      captureId: completion.captureId,
      authorizationStatus: null,
      notificationCreated: notification.created,
    };
  }
}

async function handleAuthorization({
  row,
  payload,
}: {
  row: PaymentLedgerRow;
  payload: unknown;
}): Promise<PayPalPaymentReconciliationResult> {
  const authorization = asRecord(payload);
  const authorizationId = asString(authorization?.id) ?? row.paypalAuthorizationId;
  const authorizationStatus = asString(authorization?.status)?.toUpperCase() ?? null;
  const expirationTime = asString(authorization?.expirationTime);
  const expiresAt = expirationTime ? new Date(expirationTime) : null;
  const expired = Boolean(
    expiresAt && Number.isFinite(expiresAt.getTime()) && expiresAt <= new Date(),
  );

  if (authorizationStatus === 'CREATED' && !expired) {
    const message = expirationTime
      ? `PayPal authorization is still open until ${expirationTime}. Manual capture or reauthorization review is required.`
      : 'PayPal authorization is still open. Manual capture or reauthorization review is required.';

    await paypalTxLedger.paypalIntent.update({
      where: { orderToken: row.orderToken },
      data: {
        paypalAuthorizationId: authorizationId,
        authorizePayload: safeJson(payload),
        status: PAYPAL_LEDGER_STATUS.AUTHORIZED,
        lastErrorCode: 'PAYPAL_AUTHORIZATION_STILL_OPEN',
        lastErrorMessage: message,
      },
    });

    const notification = await enqueuePaymentAttention({
      row,
      errorCode: 'PAYPAL_AUTHORIZATION_STILL_OPEN',
      errorMessage: message,
      issueSummary: [
        message,
        'The reconciliation scanner does not auto-capture authorizations.',
        'Review PayPal first, then decide whether manual capture or a new customer checkout is appropriate.',
      ],
      severity: ADMIN_NOTIFICATION_SEVERITY.WARNING,
    });

    return {
      orderToken: row.orderToken,
      ok: false,
      action: 'authorization_checked_open',
      previousStatus: row.status,
      status: PAYPAL_LEDGER_STATUS.AUTHORIZED,
      message,
      captureId: null,
      authorizationStatus,
      notificationCreated: notification.created,
    };
  }

  const errorCode =
    authorizationStatus === 'CAPTURED'
      ? 'PAYPAL_AUTHORIZATION_CAPTURED_WITHOUT_CAPTURE_PAYLOAD'
      : authorizationStatus === 'VOIDED'
        ? 'PAYPAL_AUTHORIZATION_VOIDED'
        : authorizationStatus === 'DENIED'
          ? 'PAYPAL_AUTHORIZATION_DENIED'
          : expired
            ? 'PAYPAL_AUTHORIZATION_EXPIRED'
            : 'PAYPAL_AUTHORIZATION_RECONCILIATION_REQUIRED';
  const message =
    authorizationStatus === 'CAPTURED'
      ? 'PayPal reports the authorization as captured, but no completed capture payload is stored locally.'
      : expired
        ? `PayPal authorization expired at ${expirationTime}. A new authorized payment is required before fulfillment.`
        : `PayPal authorization status is ${authorizationStatus ?? 'unknown'} and requires manual review.`;

  await paypalTxLedger.paypalIntent.update({
    where: { orderToken: row.orderToken },
    data: {
      paypalAuthorizationId: authorizationId,
      authorizePayload: safeJson(payload),
      status:
        authorizationStatus === 'PENDING'
          ? PAYPAL_LEDGER_STATUS.PENDING
          : PAYPAL_LEDGER_STATUS.ERROR,
      lastErrorCode: errorCode,
      lastErrorMessage: message,
    },
  });

  const notification = await enqueuePaymentAttention({
    row,
    errorCode,
    errorMessage: message,
    issueSummary: [
      message,
      'Fulfillment remains blocked until the PayPal payment state is resolved.',
    ],
    severity: ADMIN_NOTIFICATION_SEVERITY.CRITICAL,
  });

  return {
    orderToken: row.orderToken,
    ok: false,
    action: 'authorization_checked_attention_required',
    previousStatus: row.status,
    status:
      authorizationStatus === 'PENDING' ? PAYPAL_LEDGER_STATUS.PENDING : PAYPAL_LEDGER_STATUS.ERROR,
    message,
    captureId: null,
    authorizationStatus,
    notificationCreated: notification.created,
  };
}

async function reconcilePaymentRow(
  row: PaymentLedgerRow,
): Promise<PayPalPaymentReconciliationResult> {
  const paymentClient = getPayPalClient();
  const payments = new PaymentsController(paymentClient);
  const orders = new OrdersController(paymentClient);
  const localCaptureCompletion = getPayPalCaptureCompletion(row.capturePayload);

  if (localCaptureCompletion.captureId) {
    const { result } = await payments.getCapturedPayment({
      captureId: localCaptureCompletion.captureId,
    });

    return handleCapturedPayment({ row, payload: result });
  }

  if (row.paypalOrderId && !row.paypalAuthorizationId) {
    const { result } = await orders.getOrder({ id: row.paypalOrderId });
    const orderCapture = getNestedCapture(result);

    if (orderCapture) {
      return handleCapturedPayment({ row, payload: orderCapture });
    }

    const authorizationId = getNestedAuthorizationId(result);

    if (authorizationId) {
      await paypalTxLedger.paypalIntent.update({
        where: { orderToken: row.orderToken },
        data: {
          paypalAuthorizationId: authorizationId,
          authorizePayload: safeJson(result),
          status: PAYPAL_LEDGER_STATUS.AUTHORIZED,
        },
      });

      const { result: authorization } = await payments.getAuthorizedPayment({ authorizationId });
      return handleAuthorization({
        row: { ...row, paypalAuthorizationId: authorizationId, authorizePayload: result },
        payload: authorization,
      });
    }
  }

  if (row.paypalAuthorizationId) {
    const { result } = await payments.getAuthorizedPayment({
      authorizationId: row.paypalAuthorizationId,
    });

    return handleAuthorization({ row, payload: result });
  }

  const message = 'No PayPal capture ID or authorization ID is available for reconciliation.';
  const notification = await enqueuePaymentAttention({
    row,
    errorCode: 'PAYPAL_PAYMENT_REFERENCE_MISSING',
    errorMessage: message,
    issueSummary: [
      message,
      'Review the PayPal order from the PayPal dashboard before fulfillment.',
    ],
    severity: ADMIN_NOTIFICATION_SEVERITY.CRITICAL,
  });

  await paypalTxLedger.paypalIntent.update({
    where: { orderToken: row.orderToken },
    data: {
      status: PAYPAL_LEDGER_STATUS.ERROR,
      lastErrorCode: 'PAYPAL_PAYMENT_REFERENCE_MISSING',
      lastErrorMessage: message,
    },
  });

  return {
    orderToken: row.orderToken,
    ok: false,
    action: 'missing_payment_reference',
    previousStatus: row.status,
    status: PAYPAL_LEDGER_STATUS.ERROR,
    message,
    captureId: null,
    authorizationStatus: null,
    notificationCreated: notification.created,
  };
}

export async function runPayPalPaymentReconciliationScanner(args?: {
  dryRun?: boolean;
  batchSize?: number;
  minAgeMinutes?: number;
}) {
  const enabled = getScannerEnabled();
  const minAgeMinutes = args?.minAgeMinutes ?? getScannerMinAgeMinutes();
  const batchSize = clampBatchSize(args?.batchSize ?? getScannerBatchSize());
  const scannedAt = new Date();
  const candidates = enabled
    ? await findPayPalPaymentReconciliationRows({ batchSize, minAgeMinutes, now: scannedAt })
    : [];

  const result: PayPalPaymentReconciliationRunResult = {
    ok: true,
    enabled,
    dryRun: args?.dryRun ?? false,
    minAgeMinutes,
    batchSize,
    scannedAt: scannedAt.toISOString(),
    candidates,
    results: [],
    skipped: [],
  };

  if (!enabled || result.dryRun) return result;

  for (const candidate of candidates) {
    try {
      const row = await paypalTxLedger.paypalIntent.findUnique({
        where: { orderToken: candidate.orderToken },
        select: {
          orderToken: true,
          paypalOrderId: true,
          paypalAuthorizationId: true,
          customerName: true,
          customerEmail: true,
          initialCurrency: true,
          authorizePayload: true,
          capturePayload: true,
          status: true,
          lastErrorCode: true,
          lastErrorMessage: true,
          processingCompletedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!row || !isPaymentReconciliationCandidate(row)) {
        result.skipped.push({
          orderToken: candidate.orderToken,
          reason: 'Row is no longer eligible for payment reconciliation.',
        });
        continue;
      }

      const reconciliation = await reconcilePaymentRow(row);
      if (!reconciliation.ok) {
        result.ok = false;
      }
      result.results.push(reconciliation);
    } catch (error) {
      result.ok = false;
      result.results.push({
        orderToken: candidate.orderToken,
        ok: false,
        action: 'scanner_failed',
        previousStatus: candidate.status,
        status: null,
        message: error instanceof Error ? error.message : String(error),
        captureId: candidate.captureId,
        authorizationStatus: null,
        notificationCreated: 0,
      });
    }
  }

  return result;
}

export async function runSelectedPayPalPaymentReconciliation(args: {
  orderTokens: string[];
  dryRun?: boolean;
}) {
  const selectedOrderTokens = [...new Set(args.orderTokens.map((token) => token.trim()))].filter(
    Boolean,
  );
  const minAgeMinutes = getScannerMinAgeMinutes();
  const batchSize = clampBatchSize(getScannerBatchSize());
  const scannedAt = new Date();
  const candidates = await findPayPalPaymentReconciliationRows({
    batchSize,
    minAgeMinutes,
    now: scannedAt,
    orderTokens: selectedOrderTokens,
  });
  const candidateTokens = new Set(candidates.map((candidate) => candidate.orderToken));
  const result: PayPalPaymentReconciliationRunResult = {
    ok: true,
    enabled: getScannerEnabled(),
    dryRun: args.dryRun ?? false,
    minAgeMinutes,
    batchSize,
    scannedAt: scannedAt.toISOString(),
    candidates,
    results: [],
    skipped: selectedOrderTokens
      .filter((orderToken) => !candidateTokens.has(orderToken))
      .map((orderToken) => ({
        orderToken,
        reason: 'Row is no longer eligible for payment reconciliation.',
      })),
  };

  if (!result.enabled || result.dryRun) return result;

  for (const candidate of candidates) {
    try {
      const row = await paypalTxLedger.paypalIntent.findUnique({
        where: { orderToken: candidate.orderToken },
        select: {
          orderToken: true,
          paypalOrderId: true,
          paypalAuthorizationId: true,
          customerName: true,
          customerEmail: true,
          initialCurrency: true,
          authorizePayload: true,
          capturePayload: true,
          status: true,
          lastErrorCode: true,
          lastErrorMessage: true,
          processingCompletedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!row || !isPaymentReconciliationCandidate(row)) {
        result.skipped.push({
          orderToken: candidate.orderToken,
          reason: 'Row is no longer eligible for payment reconciliation.',
        });
        continue;
      }

      const reconciliation = await reconcilePaymentRow(row);
      if (!reconciliation.ok) {
        result.ok = false;
      }
      result.results.push(reconciliation);
    } catch (error) {
      result.ok = false;
      result.results.push({
        orderToken: candidate.orderToken,
        ok: false,
        action: 'scanner_failed',
        previousStatus: candidate.status,
        status: null,
        message: error instanceof Error ? error.message : String(error),
        captureId: candidate.captureId,
        authorizationStatus: null,
        notificationCreated: 0,
      });
    }
  }

  return result;
}

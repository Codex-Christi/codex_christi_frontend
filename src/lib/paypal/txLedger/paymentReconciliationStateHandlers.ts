import 'server-only';

import {
  ADMIN_NOTIFICATION_SEVERITY,
  enqueueAdminPaymentReconciliationNotification,
  sendPendingAdminRecoveryNotificationsForOrder,
} from '@/lib/paypal/txLedger/adminNotificationOutbox';
import { getPayPalCaptureCompletion } from '@/lib/paypal/txLedger/captureCompletion';
import {
  asRecord,
  asString,
  getProcessingAuthorizePayload,
  getRelatedAuthorizationId,
  getRelatedOrderId,
  safeJson,
} from '@/lib/paypal/txLedger/paymentReconciliationEvidence';
import type {
  PaymentLedgerRow,
  PayPalPaymentReconciliationResult,
} from '@/lib/paypal/txLedger/paymentReconciliationTypes';
import { refreshPaidOrderRecoveryProjectionSafely } from '@/lib/paypal/txLedger/paidOrderRecoveryProjection';
import { runPaidFulfillmentProcessing } from '@/lib/paypal/txLedger/runPaidFulfillmentProcessing';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import type { Prisma } from '@/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client';

const { CRITICAL, WARNING } = ADMIN_NOTIFICATION_SEVERITY;

type ResultArgs = Pick<
  PayPalPaymentReconciliationResult,
  'ok' | 'action' | 'status' | 'message'
> &
  Partial<Pick<PayPalPaymentReconciliationResult, 'captureId' | 'authorizationStatus'>> & {
    row: PaymentLedgerRow;
    notificationCreated?: number;
  };

function result({
  row,
  ok,
  action,
  status,
  message,
  captureId = null,
  authorizationStatus = null,
  notificationCreated = 0,
}: ResultArgs): PayPalPaymentReconciliationResult {
  return {
    orderToken: row.orderToken,
    ok,
    action,
    previousStatus: row.status,
    status,
    message,
    captureId,
    authorizationStatus,
    notificationCreated,
  };
}

async function updateLedger(row: PaymentLedgerRow, data: Prisma.PaypalIntentUpdateInput) {
  await paypalTxLedger.paypalIntent.update({ where: { orderToken: row.orderToken }, data });
  await refreshPaidOrderRecoveryProjectionSafely(row.orderToken);
}

async function attention({
  row,
  data,
  errorCode,
  message,
  issueSummary,
  severity,
  resultArgs,
}: {
  row: PaymentLedgerRow;
  data: Prisma.PaypalIntentUpdateInput;
  errorCode: string;
  message: string;
  issueSummary: string[];
  severity: typeof CRITICAL | typeof WARNING;
  resultArgs: Omit<ResultArgs, 'row' | 'message' | 'notificationCreated'>;
}) {
  await updateLedger(row, data);
  const notification = await enqueueAdminPaymentReconciliationNotification({
    orderToken: row.orderToken,
    paypalOrderId: row.paypalOrderId,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    ledgerStatus: row.status,
    errorCode,
    errorMessage: message,
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
  return result({ row, message, ...resultArgs, notificationCreated: notification.created });
}

function statusForIncompleteCapture(status: string | null) {
  if (status === 'PENDING') return PAYPAL_LEDGER_STATUS.PENDING;
  if (status === 'REFUNDED' || status === 'PARTIALLY_REFUNDED') {
    return PAYPAL_LEDGER_STATUS.REFUNDED;
  }
  return PAYPAL_LEDGER_STATUS.ERROR;
}

function captureLinkedData({
  row,
  payload,
  orderPayload,
  authorizationPayload,
  authorizePayload,
}: {
  row: PaymentLedgerRow;
  payload: unknown;
  orderPayload?: unknown;
  authorizationPayload?: unknown;
  authorizePayload?: unknown;
}) {
  const paypalOrderId =
    row.paypalOrderId ?? getRelatedOrderId(payload) ?? getRelatedOrderId(orderPayload);
  const paypalAuthorizationId =
    getRelatedAuthorizationId(payload) ??
    getRelatedAuthorizationId(orderPayload) ??
    getRelatedAuthorizationId(authorizationPayload) ??
    row.paypalAuthorizationId;

  return {
    ...(paypalOrderId ? { paypalOrderId } : {}),
    ...(paypalAuthorizationId ? { paypalAuthorizationId } : {}),
    ...(authorizePayload ? { authorizePayload: safeJson(authorizePayload) } : {}),
    capturePayload: safeJson(payload),
  } satisfies Prisma.PaypalIntentUpdateInput;
}

export async function handleReconciledCapture({
  row,
  payload,
  orderPayload,
  authorizationPayload,
}: {
  row: PaymentLedgerRow;
  payload: unknown;
  orderPayload?: unknown;
  authorizationPayload?: unknown;
}) {
  const completion = getPayPalCaptureCompletion(payload);
  const authorizePayload = getProcessingAuthorizePayload({
    row,
    orderPayload,
    paymentPayload: payload,
    authorizationPayload,
  });
  const baseData = captureLinkedData({
    row,
    payload,
    orderPayload,
    authorizationPayload,
    authorizePayload,
  });

  if (!completion.ok) {
    const status = statusForIncompleteCapture(completion.status);
    return attention({
      row,
      data: {
        ...baseData,
        status,
        lastErrorCode: 'CAPTURE_NOT_COMPLETED',
        lastErrorMessage: completion.reason,
      },
      errorCode: 'CAPTURE_NOT_COMPLETED',
      message: completion.reason,
      issueSummary: [
        completion.reason,
        'Fulfillment remains blocked until PayPal capture is completed.',
      ],
      severity: CRITICAL,
      resultArgs: {
        ok: false,
        action: 'capture_checked_incomplete',
        status,
        captureId: completion.captureId,
      },
    });
  }

  if (!authorizePayload) {
    const message =
      'PayPal capture is COMPLETED, but no PayPal order/customId payload is available for payment-save processing.';
    return attention({
      row,
      data: {
        ...baseData,
        status: PAYPAL_LEDGER_STATUS.ERROR,
        lastErrorCode: 'PAYPAL_CAPTURE_RECONCILED_AUTHORIZE_PAYLOAD_MISSING',
        lastErrorMessage: message,
      },
      errorCode: 'PAYPAL_CAPTURE_RECONCILED_AUTHORIZE_PAYLOAD_MISSING',
      message,
      issueSummary: [
        completion.reason,
        message,
        'Fulfillment remains blocked until PayPal order/customId evidence is restored.',
      ],
      severity: CRITICAL,
      resultArgs: {
        ok: false,
        action: 'capture_reconciled_authorize_payload_missing',
        status: PAYPAL_LEDGER_STATUS.ERROR,
        captureId: completion.captureId,
      },
    });
  }

  const notification = await attention({
    row,
    data: {
      ...baseData,
      status: PAYPAL_LEDGER_STATUS.CAPTURED,
      lastErrorCode: null,
      lastErrorMessage: null,
    },
    errorCode: 'PAYPAL_CAPTURE_RECONCILED',
    message: completion.reason,
    issueSummary: [
      completion.reason,
      'Ledger capture payload was refreshed from PayPal.',
      'Server-side fulfillment processing was resumed.',
    ],
    severity: WARNING,
    resultArgs: {
      ok: true,
      action: 'capture_reconciled_and_fulfillment_resumed',
      status: PAYPAL_LEDGER_STATUS.CAPTURED,
      captureId: completion.captureId,
    },
  });

  try {
    await runPaidFulfillmentProcessing(row.orderToken, {
      triggerDetail: 'capture_reconciled_and_fulfillment_resumed',
      triggerSource: 'payment_reconciliation',
    });
    return result({
      row,
      ok: true,
      action: 'capture_reconciled_and_fulfillment_resumed',
      status: PAYPAL_LEDGER_STATUS.CAPTURED,
      message: completion.reason,
      captureId: completion.captureId,
      notificationCreated: notification.notificationCreated,
    });
  } catch (error) {
    return result({
      row,
      ok: false,
      action: 'capture_reconciled_fulfillment_failed',
      status: PAYPAL_LEDGER_STATUS.CAPTURED,
      message: error instanceof Error ? error.message : String(error),
      captureId: completion.captureId,
      notificationCreated: notification.notificationCreated,
    });
  }
}

export async function handleReconciledAuthorization({
  row,
  payload,
  orderPayload,
}: {
  row: PaymentLedgerRow;
  payload: unknown;
  orderPayload?: unknown;
}) {
  const authorization = asRecord(payload);
  const authorizationStatus = asString(authorization?.status)?.toUpperCase() ?? null;
  const expirationTime = asString(authorization?.expirationTime);
  const expiresAt = expirationTime ? new Date(expirationTime) : null;
  const expired = Boolean(
    expiresAt && Number.isFinite(expiresAt.getTime()) && expiresAt <= new Date(),
  );
  const isOpen = authorizationStatus === 'CREATED' && !expired;
  const message = isOpen
    ? expirationTime
      ? `PayPal authorization is still open until ${expirationTime}. Manual capture or reauthorization review is required.`
      : 'PayPal authorization is still open. Manual capture or reauthorization review is required.'
    : authorizationStatus === 'CAPTURED'
      ? 'PayPal reports the authorization as captured, but no completed capture payload is stored locally.'
      : expired
        ? `PayPal authorization expired at ${expirationTime}. A new authorized payment is required before fulfillment.`
        : `PayPal authorization status is ${authorizationStatus ?? 'unknown'} and requires manual review.`;
  const errorCode = isOpen
    ? 'PAYPAL_AUTHORIZATION_STILL_OPEN'
    : authorizationStatus === 'CAPTURED'
      ? 'PAYPAL_AUTHORIZATION_CAPTURED_WITHOUT_CAPTURE_PAYLOAD'
      : authorizationStatus === 'VOIDED'
        ? 'PAYPAL_AUTHORIZATION_VOIDED'
        : authorizationStatus === 'DENIED'
          ? 'PAYPAL_AUTHORIZATION_DENIED'
          : expired
            ? 'PAYPAL_AUTHORIZATION_EXPIRED'
            : 'PAYPAL_AUTHORIZATION_RECONCILIATION_REQUIRED';
  const status = isOpen
    ? PAYPAL_LEDGER_STATUS.AUTHORIZED
    : authorizationStatus === 'PENDING'
      ? PAYPAL_LEDGER_STATUS.PENDING
      : PAYPAL_LEDGER_STATUS.ERROR;
  const paypalOrderId =
    row.paypalOrderId ?? getRelatedOrderId(payload) ?? getRelatedOrderId(orderPayload);

  return attention({
    row,
    data: {
      ...(paypalOrderId ? { paypalOrderId } : {}),
      paypalAuthorizationId: asString(authorization?.id) ?? row.paypalAuthorizationId,
      authorizePayload: safeJson(
        getProcessingAuthorizePayload({ row, orderPayload, authorizationPayload: payload }) ??
          payload,
      ),
      status,
      lastErrorCode: errorCode,
      lastErrorMessage: message,
    },
    errorCode,
    message,
    issueSummary: isOpen
      ? [
          message,
          'The reconciliation scanner does not auto-capture authorizations.',
          'Review PayPal first, then decide whether manual capture or a new customer checkout is appropriate.',
        ]
      : [message, 'Fulfillment remains blocked until the PayPal payment state is resolved.'],
    severity: isOpen ? WARNING : CRITICAL,
    resultArgs: {
      ok: false,
      action: isOpen ? 'authorization_checked_open' : 'authorization_checked_attention_required',
      status,
      authorizationStatus,
    },
  });
}

export async function handleMissingPaymentReference(row: PaymentLedgerRow) {
  const message = 'No PayPal capture ID or authorization ID is available for reconciliation.';
  return attention({
    row,
    data: {
      status: PAYPAL_LEDGER_STATUS.ERROR,
      lastErrorCode: 'PAYPAL_PAYMENT_REFERENCE_MISSING',
      lastErrorMessage: message,
    },
    errorCode: 'PAYPAL_PAYMENT_REFERENCE_MISSING',
    message,
    issueSummary: [
      message,
      'Review the PayPal order from the PayPal dashboard before fulfillment.',
    ],
    severity: CRITICAL,
    resultArgs: {
      ok: false,
      action: 'missing_payment_reference',
      status: PAYPAL_LEDGER_STATUS.ERROR,
    },
  });
}

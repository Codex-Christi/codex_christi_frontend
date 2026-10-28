import { parseCanonicalOrderSnapshotFromLedger } from '@/lib/paypal/orderSnapshot/canonicalize';
import { getCanonicalPaymentProjectionState } from '@/lib/paypal/txLedger/canonicalPaymentProjectionState';
import { PAYPAL_LEDGER_STATUS as STATUS } from '@/lib/paypal/txLedger/status';
import { formatOrderMoney } from '@/lib/shop/checkout/orderMoney';
import type { Prisma } from '@/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client';

export const historyOrderSelect = {
  id: true,
  orderToken: true,
  userId: true,
  djangoOrderIntentOrderId: true,
  status: true,
  createdAt: true,
  receiptLink: true,
  canonicalOrderSnapshot: true,
  canonicalOrderSnapshotVersion: true,
  canonicalOrderSnapshotHash: true,
  authorizePayload: true,
  capturePayload: true,
} satisfies Prisma.PaypalIntentSelect;

export type HistoryLedgerRow = Prisma.PaypalIntentGetPayload<{ select: typeof historyOrderSelect }>;
export const HISTORY_PAGE_SIZE = 20;
export const HISTORY_POST_CAPTURE_STATUSES = [
  STATUS.CAPTURED,
  STATUS.RECEIPT_UPLOADED,
  STATUS.PAYMENT_SAVED,
  STATUS.FULFILLMENT_BLOCKED,
  STATUS.FULFILLMENT_FAILED,
  STATUS.FULFILLMENT_ATTENTION_REQUIRED,
  STATUS.COMPLETED,
  STATUS.REFUNDED,
];

export type HistoryFulfillment = {
  orderToken: string;
  reference: string;
  progress: string | null;
  tracking: string | null;
  progressCheckedAt: string | null;
  trackingCheckedAt: string | null;
};

export function historyMoney(value: string, currency: string) {
  if (!/^\d+(?:\.\d+)?$/u.test(value) || !/^[A-Z]{3}$/u.test(currency)) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(Math.round(amount * 100)))
    return `${currency} ${value}`;
  try {
    return formatOrderMoney(amount, currency);
  } catch {
    return `${currency} ${value}`;
  }
}

export function historyImageUrl(value: string) {
  try {
    if (value.startsWith('/media/') && !/[\\\u0000-\u001f]/u.test(value)) {
      const local = new URL(value, 'https://history.invalid');
      return local.pathname.startsWith('/media/') ? `${local.pathname}${local.search}` : null;
    }
    const url = new URL(value);
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      ['d2dytk4tvgwhb4.cloudfront.net', 'mainmedia.codexchristi.org'].includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function historyReceiptUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.origin === 'https://payment-receipts.codexchristi.shop' &&
      url.pathname.startsWith('/paypal/') &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function toHistoryOrder(row: HistoryLedgerRow) {
  let snapshot = null;
  try {
    snapshot = parseCanonicalOrderSnapshotFromLedger(row).snapshot;
  } catch {
    /* Retain the purchase, but never substitute mutable cart data for corrupt details. */
  }
  const payment = getCanonicalPaymentProjectionState(row);
  const captured = payment.captureCompletion.ok ? payment.captureCompletion.amount : null;
  const paidAmount = captured ? historyMoney(captured.value, captured.currency) : null;
  const refunded = row.status === STATUS.REFUNDED;
  const needsReview =
    Boolean(payment.paymentFailure) ||
    !paidAmount ||
    [
      STATUS.ERROR,
      STATUS.FULFILLMENT_BLOCKED,
      STATUS.FULFILLMENT_FAILED,
      STATUS.FULFILLMENT_ATTENTION_REQUIRED,
    ].some((status) => row.status === status);
  return {
    orderToken: row.orderToken,
    reference: row.djangoOrderIntentOrderId || row.orderToken,
    createdAt: row.createdAt.toISOString(),
    status: refunded
      ? 'Refund recorded'
      : needsReview
        ? 'Needs review'
        : row.status === STATUS.COMPLETED
          ? 'Order confirmed'
          : 'Payment received',
    needsReview,
    refunded,
    paidAmount,
    expectedAmount: snapshot ? historyMoney(snapshot.total.value, snapshot.currency) : null,
    shippingAmount: snapshot ? historyMoney(snapshot.shipping.value, snapshot.currency) : null,
    receiptAvailable: Boolean(historyReceiptUrl(row.receiptLink)),
    detailsAvailable: Boolean(snapshot),
    lines:
      snapshot?.lines.map((line) => ({
        id: line.lineId,
        title: line.title,
        quantity: line.quantity,
        options: line.selectedOptions.map((option) => `${option.name}: ${option.value}`).join(', '),
        image: historyImageUrl(line.imageUrl),
        unitAmount: historyMoney(line.unitAmount.value, line.unitAmount.currency),
        lineAmount: historyMoney(line.lineAmount.value, line.lineAmount.currency),
      })) ?? [],
  };
}

export type HistoryOrder = ReturnType<typeof toHistoryOrder>;

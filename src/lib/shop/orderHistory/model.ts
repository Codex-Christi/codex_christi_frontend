import { parseCanonicalOrderSnapshotFromLedger } from '@/lib/paypal/orderSnapshot/canonicalize';
import { getCanonicalPaymentProjectionState } from '@/lib/paypal/txLedger/canonicalPaymentProjectionState';
import { PAYPAL_LEDGER_STATUS as STATUS } from '@/lib/paypal/txLedger/status';
import { formatOrderMoney } from '@/lib/shop/checkout/orderMoney';
import type { Prisma } from '@/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client';
import { object, type ShipmentPackage } from '@/lib/merchizeFulfillmentOps/customerTracking';
import { receiptObjectKey } from './receiptReference';

export const historyOrderSelect = {
  id: true,
  orderToken: true,
  userId: true,
  djangoOrderIntentOrderId: true,
  status: true,
  createdAt: true,
  receiptLink: true,
  receiptFile: true,
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
  packages?: ShipmentPackage[];
  delivered?: boolean;
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

function legacyPaymentLines(row: HistoryLedgerRow, isPaid: boolean) {
  if (
    row.canonicalOrderSnapshot != null ||
    row.canonicalOrderSnapshotVersion != null ||
    row.canonicalOrderSnapshotHash != null ||
    !isPaid
  )
    return [];
  const auth = object(row.authorizePayload);
  const units = auth?.purchaseUnits ?? auth?.purchase_units;
  if (!Array.isArray(units) || units.length !== 1) return [];
  const items = object(units[0])?.items;
  if (!Array.isArray(items) || items.length > 100) return [];
  return items.flatMap((value, index) => {
    const item = object(value);
    const quantity = Number(item?.quantity);
    const title = item?.name;
    const amount = object(item?.unitAmount ?? item?.unit_amount);
    if (
      typeof title !== 'string' ||
      !title.trim() ||
      title.length > 255 ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 1000
    )
      return [];
    const unitAmount =
      typeof amount?.value === 'string' &&
      typeof (amount.currencyCode ?? amount.currency_code) === 'string'
        ? historyMoney(amount.value, String(amount.currencyCode ?? amount.currency_code))
        : null;
    return [
      {
        id: `payment-item-${index}`,
        title: title.trim(),
        quantity,
        options: '',
        image: null as string | null,
        unitAmount,
        lineAmount: null as string | null,
      },
    ];
  });
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
  const payload = object(row.capturePayload);
  const units = payload?.purchaseUnits ?? payload?.purchase_units;
  const nested = Array.isArray(units) ? object(object(units[0])?.payments)?.captures : null;
  const capture = Array.isArray(nested) ? object(nested[0]) : payload;
  const paidDate = captured
    ? (capture?.updateTime ?? capture?.update_time ?? capture?.createTime ?? capture?.create_time)
    : null;
  const paidAt =
    typeof paidDate === 'string' && Number.isFinite(Date.parse(paidDate))
      ? new Date(paidDate).toISOString()
      : null;
  const needsReview =
    Boolean(payment.paymentFailure) ||
    !paidAmount ||
    [
      STATUS.ERROR,
      STATUS.FULFILLMENT_BLOCKED,
      STATUS.FULFILLMENT_FAILED,
      STATUS.FULFILLMENT_ATTENTION_REQUIRED,
    ].some((status) => row.status === status);
  const lines =
    snapshot?.lines.map((line) => ({
      id: line.lineId,
      title: line.title,
      quantity: line.quantity,
      options: line.selectedOptions.map((option) => `${option.name}: ${option.value}`).join(', '),
      image: historyImageUrl(line.imageUrl),
      unitAmount: historyMoney(line.unitAmount.value, line.unitAmount.currency),
      lineAmount: historyMoney(line.lineAmount.value, line.lineAmount.currency),
    })) ?? legacyPaymentLines(row, payment.isPaid);
  return {
    orderToken: row.orderToken,
    reference: row.djangoOrderIntentOrderId || row.orderToken,
    createdAt: row.createdAt.toISOString(),
    displayDate: paidAt ?? row.createdAt.toISOString(),
    dateLabel: paidAt ? 'Paid' : 'Checkout started',
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
    receiptAvailable: Boolean(receiptObjectKey(row)),
    detailsAvailable: lines.length > 0,
    detailsSource: snapshot ? 'purchase_snapshot' : lines.length ? 'payment_record' : 'unavailable',
    lines,
  };
}

export type HistoryOrder = ReturnType<typeof toHistoryOrder>;

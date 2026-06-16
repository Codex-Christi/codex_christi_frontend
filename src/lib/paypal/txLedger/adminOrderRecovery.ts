import 'server-only';

import { formatDistanceToNowStrict } from 'date-fns';

import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import type { OrderRecoveryRow, TimelineItem } from '@/components/UI/Admin/dashboard/adminShopDashboardTypes';

const ADMIN_RECOVERY_STATUSES = [
  PAYPAL_LEDGER_STATUS.CAPTURED,
  PAYPAL_LEDGER_STATUS.RECEIPT_UPLOADED,
  PAYPAL_LEDGER_STATUS.PAYMENT_SAVED,
  PAYPAL_LEDGER_STATUS.FULFILLMENT_BLOCKED,
  PAYPAL_LEDGER_STATUS.FULFILLMENT_FAILED,
  PAYPAL_LEDGER_STATUS.ERROR,
  PAYPAL_LEDGER_STATUS.COMPLETED,
] as const;

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
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

function getCaptureAmount(capturePayload: unknown, fallbackCurrency?: string | null) {
  const amountPaths = [
    ['amount'],
    ['sellerReceivableBreakdown', 'grossAmount'],
    ['seller_receivable_breakdown', 'gross_amount'],
    ['purchaseUnits', 0, 'payments', 'captures', 0, 'amount'],
    ['purchase_units', 0, 'payments', 'captures', 0, 'amount'],
  ];

  for (const path of amountPaths) {
    const amount = asRecord(getPath(capturePayload, path));
    const value = asNumber(amount?.value);
    const currency = asString(amount?.currencyCode) ?? asString(amount?.currency_code) ?? fallbackCurrency;

    if (value !== null && currency) {
      try {
        return new Intl.NumberFormat('en', {
          style: 'currency',
          currency,
        }).format(value);
      } catch {
        return `${currency} ${value.toFixed(2)}`;
      }
    }
  }

  return '—';
}

function mapLedgerStatusToAdminStatus(status: string): OrderRecoveryRow['status'] {
  if (status === PAYPAL_LEDGER_STATUS.COMPLETED) return 'completed';
  if (
    status === PAYPAL_LEDGER_STATUS.FULFILLMENT_BLOCKED ||
    status === PAYPAL_LEDGER_STATUS.FULFILLMENT_FAILED ||
    status === PAYPAL_LEDGER_STATUS.ERROR
  ) {
    return 'failed';
  }
  if (status === PAYPAL_LEDGER_STATUS.CAPTURED || status === PAYPAL_LEDGER_STATUS.RECEIPT_UPLOADED) {
    return 'recovery';
  }
  return 'pending';
}

function getStepLabel(status: string) {
  if (status === PAYPAL_LEDGER_STATUS.FULFILLMENT_BLOCKED) return 'Fulfillment Blocked';
  if (status === PAYPAL_LEDGER_STATUS.FULFILLMENT_FAILED) return 'Fulfillment Failed';
  if (status === PAYPAL_LEDGER_STATUS.PAYMENT_SAVED) return 'Payment Saved';
  if (status === PAYPAL_LEDGER_STATUS.RECEIPT_UPLOADED) return 'Receipt Prepared';
  if (status === PAYPAL_LEDGER_STATUS.CAPTURED) return 'Payment Captured';
  if (status === PAYPAL_LEDGER_STATUS.COMPLETED) return 'Completed';
  if (status === PAYPAL_LEDGER_STATUS.ERROR) return 'Post-processing Error';
  return 'In Progress';
}

function getErrorLabel(errorCode: string | null, errorMessage: string | null) {
  if (!errorCode && !errorMessage) return '—';
  if (errorCode === 'FULFILLMENT_PAYLOAD_INVALID') return 'Payload Validation Failed';
  if (errorCode === 'FULFILLMENT_PROVIDER_REJECTED') return 'Provider Rejected Fulfillment';
  if (errorCode === 'POST_PROCESSING_FAILED') return 'Post-processing Failed';
  return errorMessage ?? errorCode ?? 'Unknown error';
}

function formatUpdated(date: Date) {
  return `${formatDistanceToNowStrict(date, { addSuffix: true })}`;
}

function mapLedgerRowToOrderRecoveryRow(row: {
  orderToken: string;
  customerEmail: string;
  customerName: string;
  status: string;
  capturePayload: unknown;
  initialCurrency: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  updatedAt: Date;
}): OrderRecoveryRow {
  return {
    orderToken: row.orderToken,
    status: mapLedgerStatusToAdminStatus(row.status),
    customer: row.customerEmail || row.customerName,
    amount: getCaptureAmount(row.capturePayload, row.initialCurrency),
    step: getStepLabel(row.status),
    error: getErrorLabel(row.lastErrorCode, row.lastErrorMessage),
    supportRef: row.orderToken.slice(0, 8).toUpperCase(),
    updated: formatUpdated(row.updatedAt),
  };
}

function buildTimeline(row: {
  status: string;
  createdAt: Date;
  updatedAt: Date;
  processingCompletedAt: Date | null;
  receiptLink: string | null;
  djangoPaymentSaveCustomId: string | null;
  lastErrorCode: string | null;
}) {
  const created = formatTimelineDate(row.createdAt);
  const updated = formatTimelineDate(row.updatedAt);
  const completed = row.processingCompletedAt ? formatTimelineDate(row.processingCompletedAt) : 'Pending';

  const items: TimelineItem[] = [
    { label: 'Payment Ledger Created', time: created, state: 'done' },
    {
      label: 'Receipt Prepared',
      time: row.receiptLink ? updated : 'Pending',
      state: row.receiptLink ? 'done' : 'pending',
    },
    {
      label: 'Payment Saved to Django',
      time: row.djangoPaymentSaveCustomId ? updated : 'Pending',
      state: row.djangoPaymentSaveCustomId ? 'done' : 'pending',
    },
  ];

  if (
    row.status === PAYPAL_LEDGER_STATUS.FULFILLMENT_BLOCKED ||
    row.status === PAYPAL_LEDGER_STATUS.FULFILLMENT_FAILED ||
    row.status === PAYPAL_LEDGER_STATUS.ERROR
  ) {
    items.push({
      label:
        row.status === PAYPAL_LEDGER_STATUS.FULFILLMENT_BLOCKED
          ? 'Fulfillment Blocked'
          : row.status === PAYPAL_LEDGER_STATUS.FULFILLMENT_FAILED
            ? 'Fulfillment Failed'
            : 'Post-processing Failed',
      time: updated,
      state: 'failed',
    });
  } else if (row.status === PAYPAL_LEDGER_STATUS.COMPLETED) {
    items.push({ label: 'Fulfillment Completed', time: completed, state: 'done' });
  } else {
    items.push({ label: 'Fulfillment Pending', time: 'Pending', state: 'pending' });
  }

  return items;
}

function formatTimelineDate(date: Date) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export async function listAdminOrderRecoveryRows() {
  const rows = await paypalTxLedger.paypalIntent.findMany({
    where: {
      status: {
        in: [...ADMIN_RECOVERY_STATUSES],
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
    take: 25,
    select: {
      orderToken: true,
      customerEmail: true,
      customerName: true,
      status: true,
      capturePayload: true,
      initialCurrency: true,
      lastErrorCode: true,
      lastErrorMessage: true,
      updatedAt: true,
    },
  });

  return rows.map(mapLedgerRowToOrderRecoveryRow);
}

export async function getAdminOrderRecoveryDetail(orderToken: string) {
  const decodedOrderToken = decodeURIComponent(orderToken);
  const row = await paypalTxLedger.paypalIntent.findFirst({
    where: {
      OR: [
        { orderToken: decodedOrderToken },
        { orderToken: { startsWith: decodedOrderToken } },
      ],
    },
  });

  if (!row) return null;

  const notifications = await paypalTxLedger.adminNotificationOutbox.findMany({
    where: { orderToken: row.orderToken },
    orderBy: { createdAt: 'desc' },
  });

  return {
    row: mapLedgerRowToOrderRecoveryRow(row),
    raw: row,
    timeline: buildTimeline(row),
    notifications,
  };
}

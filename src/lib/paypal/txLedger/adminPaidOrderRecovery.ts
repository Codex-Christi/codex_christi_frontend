import 'server-only';

import { formatDistanceToNowStrict } from 'date-fns';

import { getRecoveryScannerMinAgeMinutes } from '@/lib/paypal/txLedger/processingPolicy';
import { getPayPalCaptureCompletion } from '@/lib/paypal/txLedger/captureCompletion';
import { PAYPAL_LEDGER_STATUS } from '@/lib/paypal/txLedger/status';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { listCustomerNotificationsForOrder } from '@/lib/paypal/txLedger/customerNotificationOutbox';
import {
  getPayPalLedgerProcessingSourceDisplay,
  getPayPalLedgerRunnerSourceLabel,
  getPayPalLedgerWebhookSourceLabel,
} from '@/lib/paypal/txLedger/paypalLedgerProvenance';
import {
  getMerchizeFulfillmentOpsPrisma,
  isMerchizeFulfillmentOpsDatabaseConfigured,
} from '@/lib/prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOpsPrisma';
import {
  MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS,
  MERCHIZE_FULFILLMENT_SYNC_STATUS,
} from '@/lib/merchizeFulfillmentOps/status';
import { safeLogErrorMessage } from '@/lib/merchizeFulfillmentOps/redaction';
import { isAcceptedDjangoFulfillmentProcessResponse } from '@/lib/paypal/txLedger/fulfillmentProcessResponse';
import type { Prisma } from '@/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client';
import type {
  MerchizeFulfillmentOpsAdminSummary,
  PaidOrderRecoveryActivityItem,
  PaidOrderRecoveryAddress,
  PaidOrderRecoveryDetail,
  PaidOrderRecoveryFilters,
  PaidOrderRecoveryLineItem,
  PaidOrderRecoveryListResult,
  PaidOrderRecoveryPagination,
  PaidOrderRecoveryRow,
  PaidOrderRecoveryStatusFilter,
  PaidOrderRecoveryWebhookEvent,
  TimelineItem,
} from '@/components/UI/Admin/dashboard/adminShopDashboardTypes';

const ADMIN_RECOVERY_STATUSES = [
  PAYPAL_LEDGER_STATUS.CAPTURED,
  PAYPAL_LEDGER_STATUS.RECEIPT_UPLOADED,
  PAYPAL_LEDGER_STATUS.PAYMENT_SAVED,
  PAYPAL_LEDGER_STATUS.FULFILLMENT_BLOCKED,
  PAYPAL_LEDGER_STATUS.FULFILLMENT_FAILED,
  PAYPAL_LEDGER_STATUS.FULFILLMENT_ATTENTION_REQUIRED,
  PAYPAL_LEDGER_STATUS.ERROR,
  PAYPAL_LEDGER_STATUS.COMPLETED,
] as const;

type JsonRecord = Record<string, unknown>;
const SCANNER_RECOVERABLE_STATUSES = new Set<string>([
  PAYPAL_LEDGER_STATUS.CAPTURED,
  PAYPAL_LEDGER_STATUS.RECEIPT_UPLOADED,
  PAYPAL_LEDGER_STATUS.PAYMENT_SAVED,
]);
const DEFAULT_ADMIN_RECOVERY_PAGE_SIZE = 25;
const ADMIN_RECOVERY_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const MAX_ADMIN_RECOVERY_SCAN_ROWS = 1000;
const ADMIN_RECOVERY_STATUS_FILTERS = new Set<PaidOrderRecoveryStatusFilter>([
  'all',
  'failed',
  'recovery',
  'pending',
  'completed',
  'sync',
  'attention',
]);

export type ListAdminPaidOrderRecoveryRowsArgs = {
  filters?: Partial<PaidOrderRecoveryFilters>;
  page?: number;
  pageSize?: number;
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value)))
    return Number(value);
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

function needsProviderDetailSync(payload: unknown, merchizeOpsSyncStatus?: string | null) {
  const detailOrPushSyncedStatuses = new Set<string>([
    MERCHIZE_FULFILLMENT_SYNC_STATUS.DETAIL_SYNCED,
    MERCHIZE_FULFILLMENT_SYNC_STATUS.PUSH_PENDING,
    MERCHIZE_FULFILLMENT_SYNC_STATUS.PUSH_ACCEPTED,
    MERCHIZE_FULFILLMENT_SYNC_STATUS.PUSH_FAILED,
    MERCHIZE_FULFILLMENT_SYNC_STATUS.PUSH_DISABLED,
  ]);

  return (
    isAcceptedDjangoFulfillmentProcessResponse(payload) &&
    !detailOrPushSyncedStatuses.has(merchizeOpsSyncStatus ?? '')
  );
}

function getMerchizeOrderCodeFromFulfillmentResponse(payload: unknown) {
  return (
    asString(getPath(payload, ['data', 'response_data', 'data', 'data', 'order_id'])) ??
    asString(getPath(payload, ['response_data', 'data', 'data', 'order_id']))
  );
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
    const currency =
      asString(amount?.currencyCode) ?? asString(amount?.currency_code) ?? fallbackCurrency;

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

function mapLedgerStatusToAdminStatus(status: string): PaidOrderRecoveryRow['status'] {
  if (status === PAYPAL_LEDGER_STATUS.COMPLETED) return 'completed';
  if (
    status === PAYPAL_LEDGER_STATUS.FULFILLMENT_BLOCKED ||
    status === PAYPAL_LEDGER_STATUS.FULFILLMENT_FAILED ||
    status === PAYPAL_LEDGER_STATUS.ERROR
  ) {
    return 'failed';
  }
  if (status === PAYPAL_LEDGER_STATUS.FULFILLMENT_ATTENTION_REQUIRED) return 'attention';
  if (
    status === PAYPAL_LEDGER_STATUS.CAPTURED ||
    status === PAYPAL_LEDGER_STATUS.RECEIPT_UPLOADED
  ) {
    return 'recovery';
  }
  return 'pending';
}

function normalizeRecoveryStatusFilter(
  status: string | null | undefined,
): PaidOrderRecoveryStatusFilter {
  const normalized = status?.trim() as PaidOrderRecoveryStatusFilter | undefined;

  return normalized && ADMIN_RECOVERY_STATUS_FILTERS.has(normalized) ? normalized : 'all';
}

function normalizeRecoverySearch(search: string | null | undefined) {
  return search?.trim().slice(0, 160) ?? '';
}

export function normalizePaidOrderRecoveryFilters(
  filters: {
    search?: string | null;
    status?: string | null;
  } = {},
): PaidOrderRecoveryFilters {
  return {
    search: normalizeRecoverySearch(filters.search),
    status: normalizeRecoveryStatusFilter(filters.status),
  };
}

export function getPaidOrderRecoveryPageSize(value: unknown) {
  const pageSize = Number(value);

  return ADMIN_RECOVERY_PAGE_SIZE_OPTIONS.includes(
    pageSize as (typeof ADMIN_RECOVERY_PAGE_SIZE_OPTIONS)[number],
  )
    ? pageSize
    : DEFAULT_ADMIN_RECOVERY_PAGE_SIZE;
}

export function getPaidOrderRecoveryPage(value: unknown) {
  const page = Number(value);

  return Number.isInteger(page) && page > 0 ? page : 1;
}

function getRawStatusFilter(status: PaidOrderRecoveryStatusFilter) {
  switch (status) {
    case 'failed':
      return [
        PAYPAL_LEDGER_STATUS.FULFILLMENT_BLOCKED,
        PAYPAL_LEDGER_STATUS.FULFILLMENT_FAILED,
        PAYPAL_LEDGER_STATUS.ERROR,
      ];
    case 'recovery':
      return [PAYPAL_LEDGER_STATUS.CAPTURED, PAYPAL_LEDGER_STATUS.RECEIPT_UPLOADED];
    case 'attention':
      return [PAYPAL_LEDGER_STATUS.FULFILLMENT_ATTENTION_REQUIRED];
    case 'completed':
    case 'sync':
      return [PAYPAL_LEDGER_STATUS.COMPLETED];
    case 'pending':
      return [PAYPAL_LEDGER_STATUS.PAYMENT_SAVED];
    case 'all':
    default:
      return [...ADMIN_RECOVERY_STATUSES];
  }
}

function buildPaidOrderRecoveryWhere(filters: PaidOrderRecoveryFilters) {
  const where: Prisma.PaypalIntentWhereInput = {
    status: {
      in: getRawStatusFilter(filters.status),
    },
  };

  if (filters.search) {
    const search = filters.search;
    where.OR = [
      { orderToken: { contains: search } },
      { customerEmail: { contains: search } },
      { customerName: { contains: search } },
      { paypalOrderId: { contains: search } },
      { djangoOrderIntentOrderId: { contains: search } },
      { djangoPaymentSaveCustomId: { contains: search } },
      { merchizeProviderOrderId: { contains: search } },
      { merchizeProviderOrderCode: { contains: search } },
      { lastErrorCode: { contains: search } },
      { lastErrorMessage: { contains: search } },
    ];
  }

  return where;
}

function buildPaidOrderRecoveryPagination({
  currentPage,
  pageSize,
  totalRows,
}: {
  currentPage: number;
  pageSize: number;
  totalRows: number;
}): PaidOrderRecoveryPagination {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const boundedPage = Math.min(currentPage, totalPages);

  return {
    currentPage: boundedPage,
    pageSize,
    totalRows,
    totalPages,
    pageStart: totalRows ? (boundedPage - 1) * pageSize + 1 : 0,
    pageEnd: Math.min(boundedPage * pageSize, totalRows),
  };
}

function getStepLabel(status: string) {
  if (status === PAYPAL_LEDGER_STATUS.FULFILLMENT_BLOCKED) return 'Fulfillment Blocked';
  if (status === PAYPAL_LEDGER_STATUS.FULFILLMENT_FAILED) return 'Fulfillment Failed';
  if (status === PAYPAL_LEDGER_STATUS.FULFILLMENT_ATTENTION_REQUIRED)
    return 'Fulfillment Attention Required';
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
  if (errorCode === 'MERCHIZE_PUSH_DISABLED_BY_CONFIG') return 'Push Disabled by Config';
  if (errorCode === 'POST_PROCESSING_FAILED') return 'Post-processing Failed';
  return errorMessage ?? errorCode ?? 'Unknown error';
}

function formatUpdated(date: Date) {
  return `${formatDistanceToNowStrict(date, { addSuffix: true })}`;
}

function mapLedgerRowToPaidOrderRecoveryRow(row: {
  orderToken: string;
  customerEmail: string;
  customerName: string;
  status: string;
  capturePayload: unknown;
  initialCurrency: string | null;
  merchizeFulfillmentResponsePayload: unknown;
  merchizeFulfillmentOpsSyncStatus?: string | null;
  latestWebhookSourceLabel?: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  processingTriggerDetail?: string | null;
  processingTriggeredAt?: Date | null;
  processingTriggerSource?: string | null;
  updatedAt: Date;
}): PaidOrderRecoveryRow {
  const providerDetailSyncNeeded = needsProviderDetailSync(
    row.merchizeFulfillmentResponsePayload,
    row.merchizeFulfillmentOpsSyncStatus,
  );
  const processingSource = getPayPalLedgerProcessingSourceDisplay(row);

  return {
    orderToken: row.orderToken,
    status: providerDetailSyncNeeded ? 'sync' : mapLedgerStatusToAdminStatus(row.status),
    customer: row.customerEmail || row.customerName,
    amount: getCaptureAmount(row.capturePayload, row.initialCurrency),
    step: providerDetailSyncNeeded ? 'Provider Detail Sync' : getStepLabel(row.status),
    error: providerDetailSyncNeeded
      ? 'Fulfillment accepted; sync provider details'
      : getErrorLabel(row.lastErrorCode, row.lastErrorMessage),
    processingSourceLabel: processingSource.label,
    processingSourceTone: processingSource.tone,
    supportRef: row.orderToken.slice(0, 8).toUpperCase(),
    updated: formatUpdated(row.updatedAt),
    needsProviderDetailSync: providerDetailSyncNeeded,
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
  merchizeFulfillmentResponsePayload: unknown;
  merchizeFulfillmentOpsSyncStatus?: string | null;
  merchizeFulfillmentOpsLastDetailSyncAt?: string | null;
  merchizeFulfillmentOpsProductionGateStatus?: string | null;
  merchizeFulfillmentOpsReleasedToProductionAt?: string | null;
}) {
  const created = formatTimelineDate(row.createdAt);
  const updated = formatTimelineDate(row.updatedAt);
  const completed = row.processingCompletedAt
    ? formatTimelineDate(row.processingCompletedAt)
    : 'Pending';

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
    needsProviderDetailSync(
      row.merchizeFulfillmentResponsePayload,
      row.merchizeFulfillmentOpsSyncStatus,
    )
  ) {
    items.push({
      label: 'Fulfillment Accepted; Provider Details Pending',
      time: updated,
      state: 'pending',
    });
  } else if (
    row.merchizeFulfillmentOpsProductionGateStatus ===
    MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_ACCEPTED
  ) {
    items.push({
      label: 'Merchize Push Accepted',
      time: row.merchizeFulfillmentOpsReleasedToProductionAt ?? completed,
      state: 'done',
    });
  } else if (
    row.merchizeFulfillmentOpsProductionGateStatus ===
    MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_FAILED
  ) {
    items.push({
      label: 'Merchize Push Failed',
      time: updated,
      state: 'failed',
    });
  } else if (
    row.merchizeFulfillmentOpsProductionGateStatus ===
    MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_DISABLED
  ) {
    items.push({
      label: 'Merchize Push Disabled by Config',
      time: updated,
      state: 'pending',
    });
  } else if (
    row.merchizeFulfillmentOpsSyncStatus === MERCHIZE_FULFILLMENT_SYNC_STATUS.DETAIL_SYNCED
  ) {
    items.push({
      label: 'Merchize Provider Details Synced',
      time: row.merchizeFulfillmentOpsLastDetailSyncAt ?? updated,
      state: 'done',
    });
  } else if (
    row.status === PAYPAL_LEDGER_STATUS.FULFILLMENT_BLOCKED ||
    row.status === PAYPAL_LEDGER_STATUS.FULFILLMENT_FAILED ||
    row.status === PAYPAL_LEDGER_STATUS.FULFILLMENT_ATTENTION_REQUIRED ||
    row.status === PAYPAL_LEDGER_STATUS.ERROR
  ) {
    items.push({
      label:
        row.status === PAYPAL_LEDGER_STATUS.FULFILLMENT_BLOCKED
          ? 'Fulfillment Blocked'
          : row.status === PAYPAL_LEDGER_STATUS.FULFILLMENT_FAILED
            ? 'Fulfillment Failed'
            : row.status === PAYPAL_LEDGER_STATUS.FULFILLMENT_ATTENTION_REQUIRED
              ? 'Fulfillment Attention Required'
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

function formatLongDate(date: Date | null | undefined) {
  if (!date) return '—';

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function mapMerchizeFulfillmentOpsSummary(row: {
  syncStatus: string;
  productionGateStatus: string | null;
  merchizeExternalOrderNumber: string;
  merchizeOrderId: string | null;
  merchizeStatus: string | null;
  progressStatus: string | null;
  deliveryStatus: string | null;
  costReviewStatus: string | null;
  itemCount: number;
  releasedToProductionAt: Date | null;
  lastLookupAt: Date | null;
  lastDetailSyncAt: Date | null;
  lastProgressSyncAt: Date | null;
  lastTrackingSyncAt: Date | null;
  lastSyncErrorMessage: string | null;
}): MerchizeFulfillmentOpsAdminSummary {
  return {
    syncStatus: row.syncStatus,
    productionGateStatus: row.productionGateStatus,
    merchizeExternalOrderNumber: row.merchizeExternalOrderNumber,
    merchizeOrderId: row.merchizeOrderId,
    merchizeStatus: row.merchizeStatus,
    progressStatus: row.progressStatus,
    deliveryStatus: row.deliveryStatus,
    costReviewStatus: row.costReviewStatus,
    itemCount: row.itemCount,
    releasedToProductionAt: row.releasedToProductionAt
      ? formatLongDate(row.releasedToProductionAt)
      : null,
    lastLookupAt: row.lastLookupAt ? formatLongDate(row.lastLookupAt) : null,
    lastDetailSyncAt: row.lastDetailSyncAt ? formatLongDate(row.lastDetailSyncAt) : null,
    lastProgressSyncAt: row.lastProgressSyncAt ? formatLongDate(row.lastProgressSyncAt) : null,
    lastTrackingSyncAt: row.lastTrackingSyncAt ? formatLongDate(row.lastTrackingSyncAt) : null,
    lastSyncErrorMessage: row.lastSyncErrorMessage,
  };
}

async function getMerchizeFulfillmentOpsSummaries(orderTokens: string[]) {
  const summaries = new Map<string, MerchizeFulfillmentOpsAdminSummary>();
  if (!orderTokens.length || !isMerchizeFulfillmentOpsDatabaseConfigured()) {
    return summaries;
  }

  try {
    const prisma = getMerchizeFulfillmentOpsPrisma();
    const rows = await prisma.merchizeFulfillmentOrder.findMany({
      where: { orderToken: { in: orderTokens } },
      orderBy: { updatedAt: 'desc' },
      select: {
        orderToken: true,
        syncStatus: true,
        productionGateStatus: true,
        merchizeExternalOrderNumber: true,
        merchizeOrderId: true,
        merchizeStatus: true,
        progressStatus: true,
        deliveryStatus: true,
        costReviewStatus: true,
        itemCount: true,
        releasedToProductionAt: true,
        lastLookupAt: true,
        lastDetailSyncAt: true,
        lastProgressSyncAt: true,
        lastTrackingSyncAt: true,
        lastSyncErrorMessage: true,
      },
    });

    for (const row of rows) {
      if (!summaries.has(row.orderToken)) {
        summaries.set(row.orderToken, mapMerchizeFulfillmentOpsSummary(row));
      }
    }
  } catch (error) {
    console.error('[merchize.fulfillment_ops.admin_summary_failed]', {
      error: safeLogErrorMessage(error),
    });
  }

  return summaries;
}

async function getLatestWebhookSourceByOrder(
  ledgerRows: Array<{ orderToken: string; paypalOrderId: string | null }>,
) {
  const latestByOrderToken = new Map<string, string>();
  const uniqueOrderTokens = [...new Set(ledgerRows.map((row) => row.orderToken))];
  const uniquePayPalOrderIds = [
    ...new Set(
      ledgerRows.map((row) => row.paypalOrderId).filter((value): value is string => Boolean(value)),
    ),
  ];
  const orderTokenByPayPalOrderId = new Map(
    ledgerRows.flatMap((row) => (row.paypalOrderId ? [[row.paypalOrderId, row.orderToken]] : [])),
  );

  if (!uniqueOrderTokens.length && !uniquePayPalOrderIds.length) return latestByOrderToken;

  const rows = await paypalTxLedger.paypalWebhookEvent.findMany({
    where: {
      OR: [
        { orderToken: { in: uniqueOrderTokens } },
        ...(uniquePayPalOrderIds.length ? [{ paypalOrderId: { in: uniquePayPalOrderIds } }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      matchedWebhookBindingKey: true,
      matchedWebhookLabel: true,
      matchedWebhookSource: true,
      orderToken: true,
      paypalOrderId: true,
      webhookVerificationMode: true,
    },
  });

  for (const row of rows) {
    const orderToken =
      row.orderToken ??
      (row.paypalOrderId ? orderTokenByPayPalOrderId.get(row.paypalOrderId) : null);

    if (!orderToken || latestByOrderToken.has(orderToken)) continue;

    latestByOrderToken.set(orderToken, getPayPalLedgerWebhookSourceLabel(row));
  }

  return latestByOrderToken;
}

function normalizeAddress(value: unknown): PaidOrderRecoveryAddress | null {
  const address = asRecord(value);

  if (!address) return null;

  const normalized = {
    line1: asString(address.shipping_address_line_1) ?? '',
    line2: asString(address.shipping_address_line_2) ?? '',
    city: asString(address.shipping_city) ?? '',
    state: asString(address.shipping_state) ?? '',
    postalCode: asString(address.zip_code) ?? '',
    country: asString(address.shipping_country) ?? '',
  };

  return Object.values(normalized).some(Boolean) ? normalized : null;
}

function getCartItems(cartSnapshot: unknown, currency: string | null): PaidOrderRecoveryLineItem[] {
  if (!Array.isArray(cartSnapshot)) return [];

  return cartSnapshot.map((item, index) => {
    const record = asRecord(item);
    const itemDetail = asRecord(record?.itemDetail);
    const options = Array.isArray(itemDetail?.options) ? itemDetail.options : [];
    const variant = options
      .map((option) => {
        const optionRecord = asRecord(option);
        return asString(optionRecord?.value) ?? asString(optionRecord?.name);
      })
      .filter(Boolean)
      .join(' / ');
    const unitPrice = asNumber(itemDetail?.retail_price) ?? 0;

    return {
      id: asString(record?.variantId) ?? `item-${index}`,
      title: asString(record?.title) ?? asString(itemDetail?.title) ?? 'Untitled item',
      variant:
        variant || asString(itemDetail?.sku) || asString(itemDetail?.sku_seller) || 'Standard',
      quantity: asNumber(record?.quantity) ?? 1,
      unitPrice: formatCurrency(unitPrice, currency),
      image:
        asString(itemDetail?.image) ??
        (Array.isArray(itemDetail?.image_uris) ? asString(itemDetail.image_uris[0]) : null),
    };
  });
}

function formatCurrency(value: number, currency: string | null) {
  if (!currency) return value.toFixed(2);

  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function buildActivity(row: {
  createdAt: Date;
  updatedAt: Date;
  receiptLink: string | null;
  djangoPaymentSaveCustomId: string | null;
  fulfillmentAddressOverriddenAt: Date | null;
  fulfillmentAddressOverrideReason: string | null;
  processingCompletedAt: Date | null;
  processingTriggeredAt?: Date | null;
  processingTriggerDetail?: string | null;
  processingTriggerSource?: string | null;
  status: string;
  lastErrorMessage: string | null;
  webhookEvents: PaidOrderRecoveryWebhookEvent[];
}): PaidOrderRecoveryActivityItem[] {
  const activity: PaidOrderRecoveryActivityItem[] = [
    {
      label: 'Ledger created',
      description: 'Paid checkout entered the post-payment ledger.',
      time: formatLongDate(row.createdAt),
      tone: 'slate',
    },
  ];

  if (row.receiptLink) {
    activity.push({
      label: 'Receipt prepared',
      description: 'Customer receipt was generated and attached to the order record.',
      time: formatLongDate(row.updatedAt),
      tone: 'cyan',
    });
  }

  const latestWebhook = row.webhookEvents[0];
  if (latestWebhook) {
    const webhookFailed = latestWebhook.processingStatus === 'failed';
    const laterCompleted = webhookFailed && Boolean(row.processingCompletedAt);

    activity.push({
      label: webhookFailed ? 'Webhook processing failed' : 'Webhook observed',
      description: `${latestWebhook.eventType} webhook delivery is ${latestWebhook.processingStatus}.${
        laterCompleted ? ' Ledger processing later completed successfully.' : ''
      }`,
      time: latestWebhook.processedAt ?? latestWebhook.lastAttemptAt ?? latestWebhook.createdAt,
      tone: latestWebhook.processingStatus === 'processed' ? 'emerald' : 'amber',
    });
  }

  if (row.processingTriggerSource && row.processingTriggeredAt) {
    activity.push({
      label: 'Processing runner selected',
      description: `${getPayPalLedgerRunnerSourceLabel(row.processingTriggerSource)} resumed post-payment processing${
        row.processingTriggerDetail ? ` (${row.processingTriggerDetail})` : ''
      }.`,
      time: formatLongDate(row.processingTriggeredAt),
      tone: row.processingTriggerSource === 'webhook' ? 'cyan' : 'amber',
    });
  }

  if (row.djangoPaymentSaveCustomId) {
    activity.push({
      label: 'Payment saved',
      description: 'The payment was saved to the Django order backend.',
      time: formatLongDate(row.updatedAt),
      tone: 'emerald',
    });
  }

  if (row.fulfillmentAddressOverriddenAt) {
    activity.push({
      label: 'Fulfillment address overridden',
      description:
        row.fulfillmentAddressOverrideReason ?? 'Admin saved a fulfillment address override.',
      time: formatLongDate(row.fulfillmentAddressOverriddenAt),
      tone: 'amber',
    });
  }

  if (row.processingCompletedAt) {
    activity.push({
      label: 'Processing completed',
      description: 'The order finished its server-side post-payment flow.',
      time: formatLongDate(row.processingCompletedAt),
      tone: 'emerald',
    });
  } else if (row.lastErrorMessage) {
    activity.push({
      label: 'Recovery required',
      description: row.lastErrorMessage,
      time: formatLongDate(row.updatedAt),
      tone:
        row.status === PAYPAL_LEDGER_STATUS.FULFILLMENT_BLOCKED ||
        row.status === PAYPAL_LEDGER_STATUS.FULFILLMENT_ATTENTION_REQUIRED
          ? 'amber'
          : 'rose',
    });
  }

  return activity;
}

function mapWebhookEvent(event: {
  eventId: string;
  eventType: string;
  processingStatus: string;
  attemptCount: number;
  createdAt: Date;
  processedAt: Date | null;
  lastAttemptAt: Date | null;
  lastErrorMessage: string | null;
  matchedWebhookBindingKey: string | null;
  matchedWebhookId: string | null;
  matchedWebhookLabel: string | null;
  matchedWebhookSource: string | null;
  orderToken: string | null;
  webhookVerificationMode: string | null;
}): PaidOrderRecoveryWebhookEvent {
  return {
    eventId: event.eventId,
    eventType: event.eventType,
    processingStatus: event.processingStatus,
    attemptCount: event.attemptCount,
    createdAt: formatLongDate(event.createdAt),
    processedAt: event.processedAt ? formatLongDate(event.processedAt) : null,
    lastAttemptAt: event.lastAttemptAt ? formatLongDate(event.lastAttemptAt) : null,
    lastErrorMessage: event.lastErrorMessage,
    matchedWebhookBindingKey: event.matchedWebhookBindingKey,
    matchedWebhookId: event.matchedWebhookId,
    matchedWebhookLabel: event.matchedWebhookLabel,
    matchedWebhookSource: event.matchedWebhookSource,
    orderToken: event.orderToken,
    webhookVerificationMode: event.webhookVerificationMode,
  };
}

function getScannerState(row: {
  status: string;
  capturePayload: unknown;
  processingCompletedAt: Date | null;
  postProcessingLockExpiresAt: Date | null;
  updatedAt: Date;
}) {
  if (row.processingCompletedAt) {
    return { eligible: false, reason: 'Processing is already completed.' };
  }

  if (!SCANNER_RECOVERABLE_STATUSES.has(row.status)) {
    return { eligible: false, reason: `Status ${row.status} is not automatic-scanner eligible.` };
  }

  if (!row.capturePayload) {
    return { eligible: false, reason: 'Capture payload is missing.' };
  }

  const captureCompletion = getPayPalCaptureCompletion(row.capturePayload);
  if (!captureCompletion.ok) {
    return { eligible: false, reason: captureCompletion.reason };
  }

  if (row.postProcessingLockExpiresAt && row.postProcessingLockExpiresAt > new Date()) {
    return { eligible: false, reason: 'A post-processing lock is active.' };
  }

  const minAgeMinutes = getRecoveryScannerMinAgeMinutes();
  const ageMs = Date.now() - row.updatedAt.getTime();
  if (ageMs < minAgeMinutes * 60_000) {
    return { eligible: false, reason: `Row is newer than ${minAgeMinutes} minutes.` };
  }

  return { eligible: true, reason: 'Eligible for automatic scanner recovery.' };
}

function buildDetail(row: {
  orderToken: string;
  customerName: string;
  customerEmail: string;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
  receiptLink: string | null;
  capturePayload: unknown;
  shippingSnapshot: unknown;
  fulfillmentAddressOverride: unknown;
  fulfillmentAddressOverrideReason: string | null;
  fulfillmentAddressOverriddenAt: Date | null;
  fulfillmentAddressOverriddenBy: string | null;
  cartSnapshot: unknown;
  initialCurrency: string | null;
  paypalOrderId: string | null;
  djangoOrderIntentUuid: string | null;
  djangoOrderIntentOrderId: string | null;
  djangoPaymentSaveCustomId: string | null;
  merchizeFulfillmentResponsePayload: unknown;
  merchizeFulfillmentProcessingId: string | null;
  merchizeProviderOrderId: string | null;
  merchizeProviderOrderCode: string | null;
  processingCompletedAt: Date | null;
  processingTriggeredAt: Date | null;
  processingTriggerDetail: string | null;
  processingTriggerSource: string | null;
  postProcessingLockExpiresAt: Date | null;
  status: string;
  lastErrorMessage: string | null;
  lastErrorCode: string | null;
  lastEventType: string | null;
  webhookEvents: PaidOrderRecoveryWebhookEvent[];
  merchizeFulfillmentOps: MerchizeFulfillmentOpsAdminSummary | null;
}): PaidOrderRecoveryDetail {
  const originalAddress = normalizeAddress(row.shippingSnapshot);
  const overrideAddress = normalizeAddress(row.fulfillmentAddressOverride);
  const activeAddress = overrideAddress ?? originalAddress;
  const merchizeProviderOrderId = row.merchizeProviderOrderId;
  const merchizeExternalOrderNumber =
    row.merchizeProviderOrderCode ??
    getMerchizeOrderCodeFromFulfillmentResponse(row.merchizeFulfillmentResponsePayload);
  const providerDetailSyncNeeded = needsProviderDetailSync(
    row.merchizeFulfillmentResponsePayload,
    row.merchizeFulfillmentOps?.syncStatus,
  );
  const requiresPushOverride =
    row.status === PAYPAL_LEDGER_STATUS.FULFILLMENT_ATTENTION_REQUIRED &&
    (row.lastErrorCode === 'MERCHIZE_PUSH_DISABLED_BY_CONFIG' ||
      row.merchizeFulfillmentOps?.productionGateStatus ===
        MERCHIZE_FULFILLMENT_PRODUCTION_GATE_STATUS.PUSH_DISABLED);
  const captureCompletion = getPayPalCaptureCompletion(row.capturePayload);

  return {
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    createdAt: formatLongDate(row.createdAt),
    updatedAt: formatLongDate(row.updatedAt),
    receiptLink: row.receiptLink,
    originalAddress,
    activeAddress,
    hasAddressOverride: Boolean(overrideAddress),
    addressOverrideReason: row.fulfillmentAddressOverrideReason,
    addressOverriddenAt: row.fulfillmentAddressOverriddenAt
      ? formatLongDate(row.fulfillmentAddressOverriddenAt)
      : null,
    addressOverriddenBy: row.fulfillmentAddressOverriddenBy,
    items: getCartItems(row.cartSnapshot, row.initialCurrency),
    references: [
      { label: 'Ledger order token', value: row.orderToken },
      { label: 'Authenticated user ID', value: row.userId },
      { label: 'PayPal order ID', value: row.paypalOrderId },
      { label: 'PayPal capture proof', value: captureCompletion.reason },
      { label: 'Processing source', value: row.processingTriggerSource },
      { label: 'Processing source detail', value: row.processingTriggerDetail },
      { label: 'Django order intent UUID', value: row.djangoOrderIntentUuid },
      { label: 'Django order intent order ID', value: row.djangoOrderIntentOrderId },
      { label: 'Django payment save custom ID', value: row.djangoPaymentSaveCustomId },
      { label: 'Merchize processing ID', value: row.merchizeFulfillmentProcessingId },
      {
        label: 'Merchize platform order ID',
        value: row.merchizeFulfillmentOps?.merchizeOrderId ?? merchizeProviderOrderId,
      },
      { label: 'Merchize external order number', value: merchizeExternalOrderNumber },
      {
        label: 'Merchize Ops sync status',
        value: row.merchizeFulfillmentOps?.syncStatus ?? null,
      },
      {
        label: 'Merchize push gate status',
        value: row.merchizeFulfillmentOps?.productionGateStatus ?? null,
      },
      {
        label: 'Merchize progress status',
        value: row.merchizeFulfillmentOps?.progressStatus ?? null,
      },
      {
        label: 'Merchize delivery status',
        value: row.merchizeFulfillmentOps?.deliveryStatus ?? null,
      },
      {
        label: 'Merchize cost status',
        value: row.merchizeFulfillmentOps?.costReviewStatus ?? null,
      },
      { label: 'Latest PayPal webhook event', value: row.webhookEvents[0]?.eventType ?? null },
      {
        label: 'Latest webhook delivery status',
        value: row.webhookEvents[0]?.processingStatus ?? null,
      },
      { label: 'Scanner eligibility', value: getScannerState(row).reason },
    ],
    activity: buildActivity(row),
    webhookEvents: row.webhookEvents,
    scannerState: getScannerState(row),
    merchizeFulfillmentOps: row.merchizeFulfillmentOps,
    needsProviderDetailSync: providerDetailSyncNeeded,
    requiresPushOverride,
    rawDebug: {
      orderToken: row.orderToken,
      userId: row.userId,
      status: row.status,
      lastEventType: row.lastEventType,
      lastErrorCode: row.lastErrorCode,
      lastErrorMessage: row.lastErrorMessage,
      paypalOrderId: row.paypalOrderId,
      djangoOrderIntentUuid: row.djangoOrderIntentUuid,
      djangoOrderIntentOrderId: row.djangoOrderIntentOrderId,
      djangoPaymentSaveCustomId: row.djangoPaymentSaveCustomId,
      merchizeFulfillmentProcessingId: row.merchizeFulfillmentProcessingId,
      merchizeProviderOrderId,
      merchizeExternalOrderNumber,
      merchizeFulfillmentOps: row.merchizeFulfillmentOps,
      needsProviderDetailSync: providerDetailSyncNeeded,
      requiresPushOverride,
      captureCompletion,
      scannerState: getScannerState(row),
      webhookEvents: row.webhookEvents,
      processingTriggerSource: row.processingTriggerSource,
      processingTriggerDetail: row.processingTriggerDetail,
      processingTriggeredAt: row.processingTriggeredAt,
    },
  };
}

export async function listAdminPaidOrderRecoveryRows({
  filters: rawFilters,
  page,
  pageSize,
}: ListAdminPaidOrderRecoveryRowsArgs = {}): Promise<PaidOrderRecoveryListResult> {
  const filters = normalizePaidOrderRecoveryFilters(rawFilters);
  const normalizedPageSize = getPaidOrderRecoveryPageSize(pageSize);
  const requestedPage = getPaidOrderRecoveryPage(page);
  const where = buildPaidOrderRecoveryWhere(filters);
  const rows = await paypalTxLedger.paypalIntent.findMany({
    where,
    orderBy: {
      updatedAt: 'desc',
    },
    take: MAX_ADMIN_RECOVERY_SCAN_ROWS,
    select: {
      orderToken: true,
      customerEmail: true,
      customerName: true,
      status: true,
      capturePayload: true,
      initialCurrency: true,
      merchizeFulfillmentResponsePayload: true,
      merchizeProviderOrderId: true,
      paypalOrderId: true,
      lastErrorCode: true,
      lastErrorMessage: true,
      processingTriggerDetail: true,
      processingTriggeredAt: true,
      processingTriggerSource: true,
      updatedAt: true,
    },
  });
  const [merchizeOpsSummaries, latestWebhookSourceByOrderToken] = await Promise.all([
    getMerchizeFulfillmentOpsSummaries(rows.map((row) => row.orderToken)),
    getLatestWebhookSourceByOrder(rows),
  ]);
  const mappedRows = rows
    .map((row) =>
      mapLedgerRowToPaidOrderRecoveryRow({
        ...row,
        latestWebhookSourceLabel: latestWebhookSourceByOrderToken.get(row.orderToken),
        merchizeFulfillmentOpsSyncStatus: merchizeOpsSummaries.get(row.orderToken)?.syncStatus,
      }),
    )
    .filter((row) => filters.status === 'all' || row.status === filters.status);
  const initialPagination = buildPaidOrderRecoveryPagination({
    currentPage: requestedPage,
    pageSize: normalizedPageSize,
    totalRows: mappedRows.length,
  });
  const start = (initialPagination.currentPage - 1) * normalizedPageSize;
  const pageRows = mappedRows.slice(start, start + normalizedPageSize);
  const pagination = buildPaidOrderRecoveryPagination({
    currentPage: initialPagination.currentPage,
    pageSize: normalizedPageSize,
    totalRows: mappedRows.length,
  });

  return {
    rows: pageRows,
    filters,
    pagination,
  };
}

export async function getAdminPaidOrderRecoveryDetail(orderToken: string) {
  const decodedOrderToken = decodeURIComponent(orderToken);
  const row = await paypalTxLedger.paypalIntent.findFirst({
    where: {
      OR: [{ orderToken: decodedOrderToken }, { orderToken: { startsWith: decodedOrderToken } }],
    },
  });

  if (!row) return null;

  const notifications = await paypalTxLedger.adminNotificationOutbox.findMany({
    where: { orderToken: row.orderToken },
    orderBy: { createdAt: 'desc' },
  });
  const customerNotifications = await listCustomerNotificationsForOrder(row.orderToken);
  const webhookEvents = await paypalTxLedger.paypalWebhookEvent.findMany({
    where: {
      OR: [
        { orderToken: row.orderToken },
        ...(row.paypalOrderId ? [{ paypalOrderId: row.paypalOrderId }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  const mappedWebhookEvents = webhookEvents.map(mapWebhookEvent);
  const merchizeOpsSummary =
    (await getMerchizeFulfillmentOpsSummaries([row.orderToken])).get(row.orderToken) ?? null;

  return {
    row: mapLedgerRowToPaidOrderRecoveryRow({
      ...row,
      merchizeFulfillmentOpsSyncStatus: merchizeOpsSummary?.syncStatus,
    }),
    detail: buildDetail({
      ...row,
      webhookEvents: mappedWebhookEvents,
      merchizeFulfillmentOps: merchizeOpsSummary,
    }),
    raw: row,
    timeline: buildTimeline({
      ...row,
      merchizeFulfillmentOpsSyncStatus: merchizeOpsSummary?.syncStatus,
      merchizeFulfillmentOpsLastDetailSyncAt: merchizeOpsSummary?.lastDetailSyncAt,
      merchizeFulfillmentOpsProductionGateStatus: merchizeOpsSummary?.productionGateStatus,
      merchizeFulfillmentOpsReleasedToProductionAt: merchizeOpsSummary?.releasedToProductionAt,
    }),
    notifications,
    customerNotifications,
  };
}

import 'server-only';

import {
  getMerchizeFulfillmentOpsPrisma,
  isMerchizeFulfillmentOpsDatabaseConfigured,
} from '@/lib/prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOpsPrisma';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { getCanonicalPaymentProjectionState } from '@/lib/paypal/txLedger/canonicalPaymentProjectionState';
import { isAcceptedDjangoFulfillmentProcessResponse } from '@/lib/paypal/txLedger/fulfillmentProcessResponse';
import {
  enqueueAdminRecoveryNotification,
  sendPendingAdminRecoveryNotificationsForOrder,
  ADMIN_NOTIFICATION_SEVERITY,
} from '@/lib/paypal/txLedger/adminNotificationOutbox';
import {
  enqueueCustomerFulfillmentMilestoneNotification,
  enqueueCustomerShipmentWithTracking,
} from '@/lib/paypal/txLedger/customerNotificationOutbox';
import type { ShopFulfillmentNotice } from '@/lib/shop/email/templates';
import { shipmentSummary, VERIFIED_MERCHIZE_DELIVERY_STATUS } from './customerTracking';
import { readExternalOrderProgress, type ExternalOrderProgressReference } from './externalOrderProgress';
import { extractMerchizeExternalOrderNumberFromDjangoProcessResponse } from './merchizeMapper';
import { readSupplierInvoice } from './supplierInvoice';
import { CUSTOMER_DELIVERY_NOTICE_ACTION } from './saveExternalOrderLifecycle';
import { isMerchizeFulfillmentCanceled } from './status';

const NOTICE_LOOKBACK_MS = 24 * 60 * 60_000;

type SavedLifecycle = ExternalOrderProgressReference & {
  pushVerifiedAt: Date;
  releasedToProductionAt?: Date | null;
  lastProgressSyncAt: Date | null;
  merchizeProgressPayload: unknown;
  merchizeTrackingPayload: unknown;
  deliveryStatus: string | null;
};

export function pickCustomerLifecycleNotice(
  order: SavedLifecycle,
  scanStartedAt: Date,
  now = new Date(),
): ShopFulfillmentNotice | null {
  if (!order.lastProgressSyncAt || order.lastProgressSyncAt < scanStartedAt) return null;
  const progress = readExternalOrderProgress(order.merchizeProgressPayload, order);
  if (!progress) return null;

  const delivered = progress.completed.includes('delivered');
  const event = delivered ? 'delivered'
    : progress.completed.includes('shipment_started') ? 'shipment_started'
      : progress.completed.includes('in_production') ? 'in_production' : null;
  if (!event) return null;

  // Don't mail old milestones on deployment, send an estimate, or announce a lower stage after delivery.
  const actual = progress.completedAt[event];
  if (!actual || actual < (order.releasedToProductionAt ?? order.pushVerifiedAt) || actual > now ||
    now.getTime() - actual.getTime() > NOTICE_LOOKBACK_MS) return null;
  if (delivered) {
    const confirmed = order.deliveryStatus === VERIFIED_MERCHIZE_DELIVERY_STATUS &&
      shipmentSummary(order.merchizeTrackingPayload, order.merchizeExternalOrderNumber, {
        orderDeliveryConfirmed: true,
      }).delivered;
    return confirmed ? 'delivery' : null;
  }
  return event === 'shipment_started' ? 'shipment' : 'production';
}

export async function notifyMerchizeLifecycle(
  orderToken: string,
  scanStartedAt: Date,
  deliveryOrderId?: string,
) {
  const orders = await getMerchizeFulfillmentOpsPrisma().merchizeFulfillmentOrder.findMany({
    where: { orderToken },
    select: {
      id: true,
      merchizeExternalOrderNumber: true,
      merchizeIdentifier: true,
      merchizeOrderCode: true,
      djangoPaymentSaveCustomId: true,
      duplicateDetectedAt: true,
      heldAt: true,
      productionGateStatus: true,
      pushVerifiedAt: true,
      releasedToProductionAt: true,
      lastProgressSyncAt: true,
      lastTrackingSyncAt: true,
      lastCostCheckAt: true,
      costReviewStatus: true,
      deliveryStatus: true,
      merchizeProgressPayload: true,
      merchizeTrackingPayload: true,
      merchizeFulfillmentCostPayload: true,
    },
    take: 2,
  });
  const order = orders[0];
  if (orders.length !== 1 || !order || order.duplicateDetectedAt ||
    isMerchizeFulfillmentCanceled(order.deliveryStatus) ||
    (deliveryOrderId && order.id !== deliveryOrderId)) return 'skipped';
  if (!order.pushVerifiedAt || order.productionGateStatus !== 'push_verified') return 'retry';

  const invoiceUnpaid = !deliveryOrderId && order.lastCostCheckAt && order.lastCostCheckAt >= scanStartedAt &&
    order.costReviewStatus === 'unpaid' &&
    readSupplierInvoice(order.merchizeFulfillmentCostPayload, order).state === 'unpaid';
  // For saved delivery work, measure freshness when we first saw delivery, not when the worker caught up.
  const notice = pickCustomerLifecycleNotice({
    ...order, pushVerifiedAt: order.pushVerifiedAt,
  }, scanStartedAt, deliveryOrderId ? scanStartedAt : new Date());
  const progressForTracking = !deliveryOrderId && order.lastTrackingSyncAt &&
    order.lastTrackingSyncAt >= scanStartedAt && order.lastProgressSyncAt &&
    order.lastProgressSyncAt >= scanStartedAt
    ? readExternalOrderProgress(order.merchizeProgressPayload, order)
    : null;
  const trackingReady = progressForTracking && !progressForTracking.completed.includes('delivered') &&
    shipmentSummary(order.merchizeTrackingPayload, order.merchizeExternalOrderNumber)
      .packages.some((pack) => pack.status !== 'Shipment cancelled' && (pack.trackingNumber || pack.trackingUrl));
  if (deliveryOrderId && notice !== 'delivery') {
    return order.deliveryStatus === VERIFIED_MERCHIZE_DELIVERY_STATUS ? 'skipped' : 'retry';
  }
  if (!deliveryOrderId && !invoiceUnpaid && notice === 'delivery') return 'skipped';
  if (!invoiceUnpaid && !notice && !trackingReady) return 'skipped';
  if (!invoiceUnpaid && order.heldAt) return 'retry';

  const row = await paypalTxLedger.paypalIntent.findUnique({
    where: { orderToken },
    select: {
      status: true, processingCompletedAt: true, djangoPaymentSaveCustomId: true,
      djangoOrderIntentOrderId: true, merchizeFulfillmentResponsePayload: true,
      authorizePayload: true, capturePayload: true, shippingSnapshot: true,
      canonicalOrderSnapshot: true, canonicalOrderSnapshotVersion: true, canonicalOrderSnapshotHash: true,
      paypalOrderId: true, customerName: true, customerEmail: true,
    },
  });
  if (!row || row.status === 'refunded') return 'skipped';
  if (row.status !== 'completed' || !row.processingCompletedAt) return 'retry';
  if (
    row.djangoPaymentSaveCustomId !== order.djangoPaymentSaveCustomId ||
    !isAcceptedDjangoFulfillmentProcessResponse(row.merchizeFulfillmentResponsePayload) ||
    extractMerchizeExternalOrderNumberFromDjangoProcessResponse(
      row.merchizeFulfillmentResponsePayload, row.djangoOrderIntentOrderId,
    ) !== order.merchizeExternalOrderNumber) return 'skipped';
  const payment = getCanonicalPaymentProjectionState(row);
  if (!payment.captureCompletion.ok || !payment.paymentSafeForPostProcessing) return 'skipped';

  const contact = {
    orderToken,
    paypalOrderId: row.paypalOrderId,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
  };
  if (invoiceUnpaid) {
    const alert = await enqueueAdminRecoveryNotification({
      ...contact,
      ledgerStatus: row.status,
      errorCode: 'MERCHIZE_SUPPLIER_INVOICE_UNPAID',
      errorMessage: 'The buyer paid and release was verified, but Merchize still reports the supplier invoice as unpaid.',
      issueSummary: [
        'Check the invoice and store balance in Merchize. The unpaid invoice does not identify the cause.',
        'Do not charge the buyer or push the order again.',
      ],
      severity: ADMIN_NOTIFICATION_SEVERITY.WARNING,
    });
    if (alert.created > 0) await sendPendingAdminRecoveryNotificationsForOrder(orderToken);
  } else if (notice === 'shipment' && trackingReady) {
    await enqueueCustomerShipmentWithTracking(contact);
  } else {
    if (notice) await enqueueCustomerFulfillmentMilestoneNotification(notice, contact);
    if (trackingReady && !progressForTracking?.completed.includes('shipment_started')) {
      await enqueueCustomerFulfillmentMilestoneNotification('tracking', contact);
    }
  }
  return 'succeeded';
}

export async function recoverMerchizeDeliveryNotices() {
  if (!isMerchizeFulfillmentOpsDatabaseConfigured()) return { checked: 0, deferred: 0 };
  const db = getMerchizeFulfillmentOpsPrisma();
  const work = await db.merchizeFulfillmentSyncAttempt.findMany({
    where: {
      action: CUSTOMER_DELIVERY_NOTICE_ACTION,
      status: 'pending',
      OR: [{ finishedAt: null }, { finishedAt: { lte: new Date(Date.now() - 15 * 60_000) } }],
    },
    orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
    take: 10,
    select: { id: true, orderToken: true, merchizeFulfillmentOrderId: true, startedAt: true },
  });
  let deferred = 0;
  for (const item of work) {
    const outcome = item.merchizeFulfillmentOrderId
      ? await notifyMerchizeLifecycle(item.orderToken, item.startedAt, item.merchizeFulfillmentOrderId)
          .catch(() => 'retry' as const)
      : 'skipped';
    if (outcome === 'retry') deferred++;
    // Keep the first observation time; finishedAt throttles checks for unresolved work.
    await db.merchizeFulfillmentSyncAttempt.updateMany({
      where: { id: item.id, status: 'pending' },
      data: { status: outcome === 'retry' ? 'pending' : outcome, finishedAt: new Date() },
    });
  }
  return { checked: work.length, deferred };
}

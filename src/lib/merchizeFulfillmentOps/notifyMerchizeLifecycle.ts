import 'server-only';

import { getMerchizeFulfillmentOpsPrisma } from '@/lib/prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOpsPrisma';
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
} from '@/lib/paypal/txLedger/customerNotificationOutbox';
import type { ShopFulfillmentNotice } from '@/lib/shop/email/templates';
import { shipmentSummary, VERIFIED_MERCHIZE_DELIVERY_STATUS } from './customerTracking';
import { readExternalOrderProgress, type ExternalOrderProgressReference } from './externalOrderProgress';
import { extractMerchizeExternalOrderNumberFromDjangoProcessResponse } from './merchizeMapper';
import { readSupplierInvoice } from './supplierInvoice';
import { isMerchizeFulfillmentCanceled } from './status';

const NOTICE_LOOKBACK_MS = 24 * 60 * 60_000;

type SavedLifecycle = ExternalOrderProgressReference & {
  pushVerifiedAt: Date;
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
  if (!actual || actual < order.pushVerifiedAt || actual > now ||
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

export async function notifyMerchizeLifecycle(orderToken: string, scanStartedAt: Date) {
  const orders = await getMerchizeFulfillmentOpsPrisma().merchizeFulfillmentOrder.findMany({
    where: { orderToken },
    select: {
      merchizeExternalOrderNumber: true,
      merchizeIdentifier: true,
      merchizeOrderCode: true,
      djangoPaymentSaveCustomId: true,
      duplicateDetectedAt: true,
      heldAt: true,
      productionGateStatus: true,
      pushVerifiedAt: true,
      lastProgressSyncAt: true,
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
  if (orders.length !== 1 || !order?.pushVerifiedAt || order.duplicateDetectedAt ||
    isMerchizeFulfillmentCanceled(order.deliveryStatus) ||
    order.productionGateStatus !== 'push_verified') return;

  const invoiceUnpaid = order.lastCostCheckAt && order.lastCostCheckAt >= scanStartedAt &&
    order.costReviewStatus === 'unpaid' &&
    readSupplierInvoice(order.merchizeFulfillmentCostPayload, order).state === 'unpaid';
  const notice = order.heldAt || invoiceUnpaid ? null : pickCustomerLifecycleNotice({
    ...order, pushVerifiedAt: order.pushVerifiedAt,
  }, scanStartedAt);
  if (!invoiceUnpaid && !notice) return;

  const row = await paypalTxLedger.paypalIntent.findUnique({ where: { orderToken } });
  if (row?.status !== 'completed' || !row.processingCompletedAt ||
    row.djangoPaymentSaveCustomId !== order.djangoPaymentSaveCustomId ||
    !isAcceptedDjangoFulfillmentProcessResponse(row.merchizeFulfillmentResponsePayload) ||
    extractMerchizeExternalOrderNumberFromDjangoProcessResponse(
      row.merchizeFulfillmentResponsePayload, row.djangoOrderIntentOrderId,
    ) !== order.merchizeExternalOrderNumber) return;
  const payment = getCanonicalPaymentProjectionState(row);
  if (!payment.captureCompletion.ok || !payment.paymentSafeForPostProcessing) return;

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
  } else if (notice) {
    await enqueueCustomerFulfillmentMilestoneNotification(notice, contact);
  }
}

import 'server-only';

import { extractMerchizeExternalOrderNumberFromDjangoProcessResponse } from '@/lib/merchizeFulfillmentOps/merchizeMapper';
import { isMerchizeFulfillmentCanceled } from '@/lib/merchizeFulfillmentOps/status';
import { getMerchizeFulfillmentOpsPrisma } from '@/lib/prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOpsPrisma';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { receiptObjectKey } from '@/lib/shop/orderHistory/receiptReference';
import { getCanonicalPaymentProjectionState } from './canonicalPaymentProjectionState';
import { enqueueCustomerFulfillmentPushVerifiedNotification } from './customerNotificationOutbox';
import { isAcceptedDjangoFulfillmentProcessResponse } from './fulfillmentProcessResponse';
import { refreshPaidOrderRecoveryProjectionSafely } from './paidOrderRecoveryProjection';
import { PAYPAL_LEDGER_STATUS as STATUS } from './status';

const RECONCILABLE = [
  STATUS.PAYMENT_SAVED, STATUS.FULFILLMENT_BLOCKED,
  STATUS.FULFILLMENT_FAILED, STATUS.FULFILLMENT_ATTENTION_REQUIRED,
];

/** Adopt a release already confirmed by the supplier. This path cannot call a provider. */
export async function reconcileVerifiedFulfillmentRelease(
  orderToken: string,
  deps: {
    ledger?: Pick<typeof paypalTxLedger, 'paypalIntent' | '$transaction'>;
    fulfillment?: Pick<ReturnType<typeof getMerchizeFulfillmentOpsPrisma>, 'merchizeFulfillmentOrder'>;
    refreshProjection?: (orderToken: string) => Promise<unknown>;
  } = {},
) {
  const now = new Date();
  const ledger = deps.ledger ?? paypalTxLedger;
  const row = await ledger.paypalIntent.findFirst({
    where: {
      orderToken,
      status: { in: RECONCILABLE },
      processingCompletedAt: null,
      OR: [{ postProcessingLockId: null }, { postProcessingLockExpiresAt: { lte: now } }],
    },
    select: {
      orderToken: true, status: true, updatedAt: true,
      djangoPaymentSaveCustomId: true, djangoOrderIntentOrderId: true,
      merchizeFulfillmentResponsePayload: true,
      canonicalOrderSnapshot: true, canonicalOrderSnapshotVersion: true, canonicalOrderSnapshotHash: true,
      shippingSnapshot: true, authorizePayload: true, capturePayload: true,
      paypalOrderId: true, customerName: true, customerEmail: true, receiptFile: true, receiptLink: true,
    },
  });
  if (!row || !row.djangoPaymentSaveCustomId || !receiptObjectKey(row) ||
    !isAcceptedDjangoFulfillmentProcessResponse(row.merchizeFulfillmentResponsePayload)) return false;
  const payment = getCanonicalPaymentProjectionState(row);
  if (!payment.captureCompletion.ok || !payment.paymentSafeForPostProcessing) return false;
  const externalNumber = extractMerchizeExternalOrderNumberFromDjangoProcessResponse(
    row.merchizeFulfillmentResponsePayload, row.djangoOrderIntentOrderId,
  );
  const fulfillment = deps.fulfillment ?? getMerchizeFulfillmentOpsPrisma();
  const orders = await fulfillment.merchizeFulfillmentOrder.findMany({
    where: { orderToken },
    take: 2,
    select: {
      merchizeOrderId: true, merchizeExternalOrderNumber: true, djangoPaymentSaveCustomId: true,
      duplicateDetectedAt: true, productionGateStatus: true, pushVerifiedAt: true,
      merchizeIsDeleted: true, deliveryStatus: true,
    },
  });
  const order = orders[0];
  if (orders.length !== 1 || !order?.merchizeOrderId || !externalNumber ||
    order.merchizeExternalOrderNumber !== externalNumber ||
    order.djangoPaymentSaveCustomId !== row.djangoPaymentSaveCustomId ||
    order.duplicateDetectedAt || order.merchizeIsDeleted ||
    order.productionGateStatus !== 'push_verified' || !order.pushVerifiedAt ||
    isMerchizeFulfillmentCanceled(order.deliveryStatus)) return false;

  const adopted = await ledger.$transaction(async (tx) => {
    const updated = await tx.paypalIntent.updateMany({
      where: {
        orderToken,
        updatedAt: row.updatedAt,
        status: row.status,
        processingCompletedAt: null,
        OR: [{ postProcessingLockId: null }, { postProcessingLockExpiresAt: { lte: now } }],
      },
      data: {
        status: STATUS.COMPLETED,
        processingCompletedAt: now,
        lastErrorCode: null,
        lastErrorMessage: null,
        postProcessingLockId: null,
        postProcessingLockedAt: null,
        postProcessingLockExpiresAt: null,
      },
    });
    if (!updated.count) return false;
    await enqueueCustomerFulfillmentPushVerifiedNotification({
      db: tx, orderToken, paypalOrderId: row.paypalOrderId,
      customerName: row.customerName, customerEmail: row.customerEmail, receiptLink: row.receiptLink,
    });
    return true;
  });
  if (adopted) await (deps.refreshProjection ?? refreshPaidOrderRecoveryProjectionSafely)(orderToken);
  return adopted;
}

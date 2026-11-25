import 'server-only';

import { getMerchizeFulfillmentOpsPrisma } from '@/lib/prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOpsPrisma';
import {
  object,
  scopeSingleOrderTracking,
  shipmentSummary,
  stampShipmentSnapshot,
} from './customerTracking';
import {
  knownMerchizeOrderCode,
  readExternalOrderProgress,
  type ExternalOrderProgressReference,
} from './externalOrderProgress';
import { MerchizeApiError, type MerchizeExternalOrderReference } from './merchizeClient';
import { toOptionalPrismaJson } from './merchizeMapper';
import { MERCHIZE_CANCELLATION_STATUSES } from './status';

type LifecycleOrder = ExternalOrderProgressReference & {
  id: string;
  merchizeIdentifier: string | null;
  merchizeOrderCode: string | null;
};

export const CUSTOMER_DELIVERY_NOTICE_ACTION = 'customer_delivery_notification';

export function externalOrderLifecycleReference(
  order: LifecycleOrder,
): MerchizeExternalOrderReference {
  const code = knownMerchizeOrderCode(order);
  return code
    ? { code }
    : {
        externalNumber: order.merchizeExternalOrderNumber,
        identifier: order.merchizeIdentifier,
      };
}

export function externalOrderLifecycleWriter(
  db: ReturnType<typeof getMerchizeFulfillmentOpsPrisma>,
  order: LifecycleOrder & { orderToken: string },
) {
  const checkedAt = new Date();
  const where = {
    id: order.id,
    merchizeExternalOrderNumber: order.merchizeExternalOrderNumber,
    merchizeIdentifier: order.merchizeIdentifier,
    merchizeOrderCode: order.merchizeOrderCode,
    duplicateDetectedAt: null,
    AND: [{ OR: [{ deliveryStatus: null }, { deliveryStatus: { notIn: [...MERCHIZE_CANCELLATION_STATUSES] } }] }],
  };

  return {
    async saveProgress(payload: unknown) {
      const progress = readExternalOrderProgress(payload, order);
      if (!progress)
        throw new MerchizeApiError('Could not verify the Merchize order progress response.', {
          code: 'MERCHIZE_EXTERNAL_ORDER_PROGRESS_UNVERIFIED',
        });
      const saved = await db.merchizeFulfillmentOrder.updateMany({
        where: {
          ...where,
          OR: [{ lastProgressSyncAt: null }, { lastProgressSyncAt: { lt: checkedAt } }],
        },
        data: {
          merchizeProgressPayload: toOptionalPrismaJson(stampShipmentSnapshot(payload, checkedAt)),
          progressStatus: progress.status,
          lastProgressSyncAt: checkedAt,
        },
      });
      return saved.count === 1 && progress.completed.includes('delivered');
    },

    async saveTracking(payload: unknown, orderDeliveryConfirmed: Promise<boolean | null>) {
      const envelope = object(payload);
      // An empty successful read has no package evidence. Keep any earlier snapshot.
      if (envelope?.success === true && Array.isArray(envelope.data) && !envelope.data.length) {
        return 'unchanged' as const;
      }
      const scoped = scopeSingleOrderTracking(payload, {
        ...order, merchizeOrderCode: knownMerchizeOrderCode(order),
      });
      if (!scoped)
        throw new MerchizeApiError('Could not verify the Merchize tracking response.', {
          code: 'MERCHIZE_EXTERNAL_ORDER_TRACKING_UNVERIFIED',
        });
      const reference = order.merchizeExternalOrderNumber;
      const trackingWhere = {
        ...where,
        OR: [{ lastTrackingSyncAt: null }, { lastTrackingSyncAt: { lt: checkedAt } }],
      };
      const data = {
        merchizeTrackingPayload: toOptionalPrismaJson(stampShipmentSnapshot(scoped, checkedAt)),
        lastTrackingSyncAt: checkedAt,
      };
      const summary = shipmentSummary(scoped, reference);
      const tracking = summary.packages.some((pack) => pack.trackingNumber || pack.trackingUrl)
        ? 'available' as const : 'not_available' as const;
      if (await orderDeliveryConfirmed) {
        const confirmed = shipmentSummary(scoped, reference, { orderDeliveryConfirmed: true });
        if (confirmed.delivered) {
          const saved = await db.$transaction(async (tx) => {
            const updated = await tx.merchizeFulfillmentOrder.updateMany({
              where: { ...trackingWhere, lastProgressSyncAt: checkedAt },
              data: { ...data, deliveryStatus: confirmed.deliveryStatus },
            });
            // Delivered orders leave the regular scan. Save the email work before that happens.
            if (updated.count === 1) {
              await tx.merchizeFulfillmentSyncAttempt.createMany({
                data: [{
                  id: `customer-delivery:${order.id}`,
                  action: CUSTOMER_DELIVERY_NOTICE_ACTION,
                  status: 'pending',
                  orderToken: order.orderToken,
                  merchizeFulfillmentOrderId: order.id,
                  startedAt: checkedAt,
                }],
                skipDuplicates: true,
              });
            }
            return updated;
          });
          if (saved.count === 1) return tracking;
        }
      }
      const saved = await db.merchizeFulfillmentOrder.updateMany({
        where: tracking === 'available' ? trackingWhere : {
          ...trackingWhere,
          AND: [
            ...where.AND,
            { OR: [{ deliveryStatus: null }, { deliveryStatus: { notIn: ['tracking_available', 'delivered_verified'] } }] },
          ],
        },
        data: {
          ...data,
          deliveryStatus: summary.delivered ? 'tracking_available' : summary.deliveryStatus,
        },
      });
      return saved.count === 1 ? tracking : 'unchanged' as const;
    },
  };
}

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
  order: LifecycleOrder,
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
      if (envelope?.success === true && Array.isArray(envelope.data) && !envelope.data.length) return;
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
      if (await orderDeliveryConfirmed) {
        const confirmed = shipmentSummary(scoped, reference, { orderDeliveryConfirmed: true });
        if (confirmed.delivered) {
          const saved = await db.merchizeFulfillmentOrder.updateMany({
            where: { ...trackingWhere, lastProgressSyncAt: checkedAt },
            data: { ...data, deliveryStatus: confirmed.deliveryStatus },
          });
          if (saved.count === 1) return;
        }
      }
      await db.merchizeFulfillmentOrder.updateMany({
        where: trackingWhere,
        data: {
          ...data,
          deliveryStatus: summary.delivered ? 'tracking_available' : summary.deliveryStatus,
        },
      });
    },
  };
}

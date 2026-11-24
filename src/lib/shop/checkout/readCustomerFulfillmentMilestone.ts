import 'server-only';

import { asRecord } from '@/lib/merchizeFulfillmentOps/merchizeMapper';
import { shipmentSummary, VERIFIED_MERCHIZE_DELIVERY_STATUS } from '@/lib/merchizeFulfillmentOps/customerTracking';
import { readExternalOrderProgress } from '@/lib/merchizeFulfillmentOps/externalOrderProgress';
import { MERCHIZE_ORDER_ON_HOLD } from '@/lib/merchizeFulfillmentOps/status';
import { savedFulfillmentHoldCheck } from './readCustomerFulfillmentHold';
import {
  getMerchizeFulfillmentOpsPrisma,
  isMerchizeFulfillmentOpsDatabaseConfigured,
} from '@/lib/prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOpsPrisma';
import type { CustomerPostPurchaseStage } from './customerPostPurchaseStage';

export type SavedFulfillmentMilestone = {
  stage: CustomerPostPurchaseStage | null;
  checkedAt: Date | null;
  onHold: boolean;
};

type SavedFulfillment = {
  merchizeExternalOrderNumber: string;
  merchizeIdentifier: string | null;
  merchizeOrderCode: string | null;
  merchizeProgressPayload: unknown;
  merchizeTrackingPayload: unknown;
  deliveryStatus: string | null;
  lastProgressSyncAt: Date | null;
  pushVerifiedAt: Date | null;
  duplicateDetectedAt: Date | null;
  productionGateStatus: string | null;
  addressReviewStatus: string | null;
  lastReadinessCheckAt: Date | null;
  merchizeProductionReadinessPayload: unknown;
  heldAt: Date | null;
  lastLookupAt: Date | null;
};

export type CustomerFulfillmentLookup = {
  orderToken: string;
  djangoPaymentSaveCustomId: string;
  addressChangedAt: Date | null;
};

const milestoneSelect = {
  orderToken: true,
  djangoPaymentSaveCustomId: true,
  merchizeExternalOrderNumber: true,
  merchizeIdentifier: true,
  merchizeOrderCode: true,
  merchizeProgressPayload: true,
  merchizeTrackingPayload: true,
  deliveryStatus: true,
  lastProgressSyncAt: true,
  pushVerifiedAt: true,
  duplicateDetectedAt: true,
  productionGateStatus: true,
  addressReviewStatus: true,
  lastReadinessCheckAt: true,
  merchizeProductionReadinessPayload: true,
  heldAt: true,
  lastLookupAt: true,
} as const;

export function projectCustomerFulfillmentMilestone(
  row: SavedFulfillment,
  addressChangedAt: Date | null,
): SavedFulfillmentMilestone | null {
  if (row.duplicateDetectedAt) return null;
  const holdCheckedAt = savedFulfillmentHoldCheck(row);
  const withHold = (stage: CustomerPostPurchaseStage | null, checkedAt: Date | null) => ({
    stage,
    onHold: Boolean(holdCheckedAt),
    checkedAt: holdCheckedAt ?? checkedAt,
  });

  if (row.pushVerifiedAt && row.productionGateStatus === 'push_verified') {
    const progress = readExternalOrderProgress(row.merchizeProgressPayload, row);
    const orderDeliveryConfirmed = row.deliveryStatus === VERIFIED_MERCHIZE_DELIVERY_STATUS;
    const delivered =
      orderDeliveryConfirmed &&
      progress?.completed.includes('delivered') &&
      shipmentSummary(row.merchizeTrackingPayload, row.merchizeExternalOrderNumber, {
        orderDeliveryConfirmed,
      }).delivered;
    const stage =
      delivered
        ? 'delivered'
        : progress?.completed.includes('shipment_started')
          ? 'shipped'
          : progress?.completed.includes('in_production')
            ? 'production_started'
            : 'sent_for_preparation';
    return withHold(
      stage,
      stage === 'sent_for_preparation' ? row.pushVerifiedAt : row.lastProgressSyncAt,
    );
  }

  const checkedAt = row.lastReadinessCheckAt;
  if (!checkedAt || (addressChangedAt && checkedAt < addressChangedAt))
    return row.heldAt ? withHold(null, null) : null;
  const readiness = asRecord(row.merchizeProductionReadinessPayload);
  if (row.addressReviewStatus === 'pending')
    return withHold('checking_delivery_details', checkedAt);
  if (readiness?.status === 'blocked') {
    const blockers = readiness.blockers;
    if (
      !row.heldAt &&
      row.lastLookupAt &&
      row.lastLookupAt > checkedAt &&
      Array.isArray(blockers) &&
      blockers.length === 1 &&
      asRecord(blockers[0])?.code === MERCHIZE_ORDER_ON_HOLD
    ) {
      return withHold('awaiting_preparation', row.lastLookupAt);
    }
    return withHold('preparation_under_review', checkedAt);
  }
  const addressReady =
    (row.addressReviewStatus === 'ready' || row.addressReviewStatus === 'buyer_confirmed') &&
    readiness?.addressReadbackStatus === 'matched';
  if (addressReady && readiness?.providerPushState === 'pending') {
    return withHold('order_received', checkedAt);
  }
  if (
    addressReady &&
    ['ready', 'push_disabled', 'manual_release_required'].includes(row.productionGateStatus ?? '')
  ) {
    return withHold('awaiting_preparation', checkedAt);
  }
  return row.heldAt ? withHold(null, null) : null;
}

/** Call only after order access, payment, and the Django handoff are verified. */
export async function readCustomerFulfillmentMilestones(orders: CustomerFulfillmentLookup[]) {
  const milestones = new Map<string, SavedFulfillmentMilestone>();
  if (!orders.length || !isMerchizeFulfillmentOpsDatabaseConfigured()) return milestones;

  try {
    const requested = new Map(orders.map((order) => [order.orderToken, order]));
    const take = requested.size * 2 + 1;
    const rows = await getMerchizeFulfillmentOpsPrisma().merchizeFulfillmentOrder.findMany({
      where: {
        OR: [...requested.values()].map(({ orderToken, djangoPaymentSaveCustomId }) => ({
          orderToken,
          djangoPaymentSaveCustomId,
        })),
      },
      select: milestoneSelect,
      take,
    });
    // If the result may be truncated, we cannot rule out unseen duplicate rows.
    if (rows.length >= take) return milestones;
    const seen = new Set<string>();
    for (const row of rows) {
      const order = requested.get(row.orderToken);
      if (!order || order.djangoPaymentSaveCustomId !== row.djangoPaymentSaveCustomId) continue;
      if (seen.has(row.orderToken)) {
        milestones.delete(row.orderToken);
        continue;
      }
      seen.add(row.orderToken);
      const milestone = projectCustomerFulfillmentMilestone(row, order.addressChangedAt);
      if (milestone) milestones.set(row.orderToken, milestone);
    }
    return milestones;
  } catch {
    // Fulfillment snapshots are optional; payment confirmation must remain available.
    return new Map<string, SavedFulfillmentMilestone>();
  }
}

export async function readCustomerFulfillmentMilestone(order: CustomerFulfillmentLookup) {
  return (await readCustomerFulfillmentMilestones([order])).get(order.orderToken) ?? null;
}

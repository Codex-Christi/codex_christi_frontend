import 'server-only';

import { asRecord } from './merchizeMapper';
import type { MerchizeExternalOrderReference } from './merchizeClient';
import { isMerchizeFulfillmentCanceled, MERCHIZE_FULFILLMENT_CANCELED } from './status';

const externalStates = [
  'on_hold',
  'unfulfilled',
  'fulfilled',
  'delivered',
  MERCHIZE_FULFILLMENT_CANCELED,
] as const;

type ExternalState = (typeof externalStates)[number];

export type HoldLookupOrder = {
  id: string;
  merchizeOrderId: string | null;
  merchizeExternalOrderNumber: string;
  merchizeIdentifier: string | null;
  heldAt: Date | null;
  lastLookupAt: Date | null;
};

export function readExternalOrderState(
  order: HoldLookupOrder,
  data: unknown,
): ExternalState | null {
  const row = asRecord(data);
  if (!row || !order.merchizeOrderId || row._id !== order.merchizeOrderId) return null;
  if (row.external_number && row.external_number !== order.merchizeExternalOrderNumber) return null;
  if (order.merchizeIdentifier && row.identifier && row.identifier !== order.merchizeIdentifier)
    return null;
  const status = row.order_status;
  if (typeof status === 'string' && isMerchizeFulfillmentCanceled(status)) {
    return MERCHIZE_FULFILLMENT_CANCELED;
  }
  return externalStates.find((known) => known === status) ?? null;
}

export function observedOrderHold(order: HoldLookupOrder, state: ExternalState, checkedAt: Date) {
  return {
    heldAt: state === 'on_hold' ? (order.heldAt ?? checkedAt) : null,
    lastLookupAt: checkedAt,
    ...(state === MERCHIZE_FULFILLMENT_CANCELED ? { deliveryStatus: state } : {}),
  };
}

export function canObserveOrderHold(order: HoldLookupOrder, checkedAt: Date) {
  return !order.lastLookupAt || order.lastLookupAt < checkedAt;
}

export type HoldReader = {
  read: (references: MerchizeExternalOrderReference[]) => Promise<unknown>;
  save: (
    order: HoldLookupOrder,
    observation: ReturnType<typeof observedOrderHold>,
  ) => Promise<boolean>;
};

/** Only reads existing provider orders. The caller supplies a conditional write for freshness. */
export async function reconcileMerchizeOrderHolds(
  orders: HoldLookupOrder[],
  reader: HoldReader,
  checkedAt = new Date(),
) {
  if (!orders.length) return [];
  const response = asRecord(
    await reader.read(
      orders.map((order) => ({
        externalNumber: order.merchizeExternalOrderNumber,
        identifier: order.merchizeIdentifier,
      })),
    ),
  );
  const rows = response?.success === true && Array.isArray(response.data) ? response.data : [];

  return Promise.all(
    orders.map(async (order) => {
      const matches = rows.filter((row) => asRecord(row)?._id === order.merchizeOrderId);
      const unique = orders.filter(
        (candidate) => candidate.merchizeOrderId === order.merchizeOrderId,
      );
      const state =
        matches.length === 1 && unique.length === 1
          ? readExternalOrderState(order, matches[0])
          : null;
      const saved =
        state && canObserveOrderHold(order, checkedAt)
          ? await reader.save(order, observedOrderHold(order, state, checkedAt))
          : false;
      return { id: order.id, state, saved };
    }),
  );
}

export const holdLookupSelect = {
  id: true,
  merchizeOrderId: true,
  merchizeExternalOrderNumber: true,
  merchizeIdentifier: true,
  heldAt: true,
  lastLookupAt: true,
} as const;

export function holdLookupVersion(order: HoldLookupOrder) {
  return {
    id: order.id,
    merchizeOrderId: order.merchizeOrderId,
    merchizeExternalOrderNumber: order.merchizeExternalOrderNumber,
    merchizeIdentifier: order.merchizeIdentifier,
    heldAt: order.heldAt,
    lastLookupAt: order.lastLookupAt,
  };
}

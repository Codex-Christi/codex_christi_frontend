import 'server-only';
import { getServerAuthSnapshot } from '@/lib/session/server-session';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import {
  getMerchizeFulfillmentOpsPrisma,
  isMerchizeFulfillmentOpsDatabaseConfigured,
} from '@/lib/prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOpsPrisma';
import { createAccountOrderReader } from './reader';
import {
  shipmentLabel,
  shipmentSummary,
  snapshotCheckedAt,
} from '@/lib/merchizeFulfillmentOps/customerTracking';

export const accountOrders = createAccountOrderReader({
  session: getServerAuthSnapshot,
  list: (query) => paypalTxLedger.paypalIntent.findMany(query),
  detail: (query) => paypalTxLedger.paypalIntent.findFirst(query),
  fulfillment: async (tokens) => {
    if (!isMerchizeFulfillmentOpsDatabaseConfigured())
      throw new Error('Shipment updates unavailable.');
    const rows = await getMerchizeFulfillmentOpsPrisma().merchizeFulfillmentOrder.findMany({
      where: { orderToken: { in: tokens } },
      take: 100,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: {
        orderToken: true,
        merchizeExternalOrderNumber: true,
        progressStatus: true,
        lastTrackingSyncAt: true,
        merchizeProgressPayload: true,
        merchizeTrackingPayload: true,
      },
    });
    return rows.map((row) => {
      const shipment = shipmentSummary(
        row.merchizeTrackingPayload,
        row.merchizeExternalOrderNumber,
      );
      return {
        orderToken: row.orderToken,
        reference: row.merchizeExternalOrderNumber,
        progress: row.progressStatus ? shipmentLabel(row.progressStatus.split(':')[0]) : null,
        tracking: shipment.label,
        progressCheckedAt: snapshotCheckedAt(row.merchizeProgressPayload),
        trackingCheckedAt:
          snapshotCheckedAt(row.merchizeTrackingPayload) ??
          row.lastTrackingSyncAt?.toISOString() ??
          null,
        packages: shipment.packages,
        delivered: shipment.delivered,
      };
    });
  },
});

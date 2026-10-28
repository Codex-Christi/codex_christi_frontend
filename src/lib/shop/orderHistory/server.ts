import 'server-only';
import { getServerAuthSnapshot } from '@/lib/session/server-session';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import {
  getMerchizeFulfillmentOpsPrisma,
  isMerchizeFulfillmentOpsDatabaseConfigured,
} from '@/lib/prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOpsPrisma';
import { createAccountOrderReader } from './reader';

function label(value: string | null) {
  return value ? value.replace(/[_:]+/gu, ' ').slice(0, 120) : null;
}

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
        deliveryStatus: true,
        lastProgressSyncAt: true,
        lastTrackingSyncAt: true,
      },
    });
    return rows.map((row) => ({
      orderToken: row.orderToken,
      reference: row.merchizeExternalOrderNumber,
      progress: label(row.progressStatus),
      tracking: label(row.deliveryStatus),
      progressCheckedAt: row.lastProgressSyncAt?.toISOString() ?? null,
      trackingCheckedAt: row.lastTrackingSyncAt?.toISOString() ?? null,
    }));
  },
});

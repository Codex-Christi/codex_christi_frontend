import 'server-only';
import { getMerchizeFulfillmentOpsPrisma } from '@/lib/prisma/shop/merchizeFulfillmentOps/merchizeFulfillmentOpsPrisma';
import { assertShopOpsMutationAllowed } from '@/lib/prisma/shop/shopOpsDataTarget';
import {
  getMerchizeExternalOrderProgress,
  getMerchizeExternalOrderTracking,
} from './merchizeClient';
import {
  object,
  matchingShipmentRecords,
  shipmentSummary,
  stampShipmentSnapshot,
} from './customerTracking';
import { toOptionalPrismaJson } from './merchizeMapper';

export const TRACKING_REFRESH_SECONDS = 60;

/** Explicit customer command: reads supplier tracking only, never creation or fulfillment. */
export async function refreshCustomerTracking(orderToken: string) {
  assertShopOpsMutationAllowed();
  const db = getMerchizeFulfillmentOpsPrisma();
  const attempt = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`customer-tracking:${orderToken}`}, 0))`;
    const latest = await tx.merchizeFulfillmentSyncAttempt.findFirst({
      where: {
        orderToken,
        action: 'customer_tracking_refresh',
        startedAt: { gt: new Date(Date.now() - TRACKING_REFRESH_SECONDS * 1000) },
      },
      orderBy: { startedAt: 'desc' },
      select: { id: true },
    });
    if (latest) return null;
    return tx.merchizeFulfillmentSyncAttempt.create({
      data: { orderToken, action: 'customer_tracking_refresh', status: 'running' },
      select: { id: true },
    });
  });
  if (!attempt)
    return {
      refreshed: false,
      retryAfter: TRACKING_REFRESH_SECONDS,
      message: 'Tracking was checked recently. Please wait a minute before checking again.',
    };
  let failed = false;
  try {
    const rows = await db.merchizeFulfillmentOrder.findMany({
      where: { orderToken },
      take: 5,
      orderBy: { id: 'asc' },
      select: { id: true, merchizeExternalOrderNumber: true, merchizeIdentifier: true },
    });
    await Promise.all(
      rows.map(async (row) => {
        const reference = {
          externalNumber: row.merchizeExternalOrderNumber,
          identifier: row.merchizeIdentifier,
        };
        const results = await Promise.allSettled([
          getMerchizeExternalOrderProgress(reference).then(async (payload) => {
            if (payload.success !== true || payload.data == null)
              throw new Error('Progress unavailable');
            // Preserve the same snapshot/status pairing used by operational synchronization.
            const data = matchingShipmentRecords(payload, row.merchizeExternalOrderNumber)[0];
            if (!data || (!Array.isArray(data.order_progress) && typeof data.status !== 'string'))
              throw new Error('Progress could not be verified');
            const events = Array.isArray(data?.order_progress) ? data.order_progress : [];
            const current = events
              .map(object)
              .find(
                (event) => event && typeof event.status === 'string' && event.status !== 'done',
              );
            const progress =
              typeof current?.event === 'string'
                ? current.event.slice(0, 100)
                : typeof data?.status === 'string'
                  ? data.status.slice(0, 100)
                  : 'preparing';
            await db.merchizeFulfillmentOrder.update({
              where: { id: row.id },
              data: {
                merchizeProgressPayload: toOptionalPrismaJson(stampShipmentSnapshot(payload)),
                progressStatus: progress,
                lastProgressSyncAt: new Date(),
              },
            });
          }),
          getMerchizeExternalOrderTracking(reference).then(async (payload) => {
            if (payload.success !== true || payload.data == null)
              throw new Error('Tracking unavailable');
            const matching = matchingShipmentRecords(payload, row.merchizeExternalOrderNumber);
            if (
              !matching.length ||
              !matching.some(
                (data) =>
                  Array.isArray(data.packages) ||
                  Array.isArray(data.package_progresses) ||
                  typeof data.has_tracking === 'boolean' ||
                  typeof data.tracking_number === 'string',
              )
            )
              throw new Error('Tracking could not be verified');
            const summary = shipmentSummary(payload, row.merchizeExternalOrderNumber);
            await db.merchizeFulfillmentOrder.update({
              where: { id: row.id },
              data: {
                merchizeTrackingPayload: toOptionalPrismaJson(stampShipmentSnapshot(payload)),
                deliveryStatus: summary.delivered
                  ? 'delivered'
                  : summary.packages.some((pack) => pack.trackingNumber)
                    ? 'tracking_available'
                    : null,
                lastTrackingSyncAt: new Date(),
              },
            });
          }),
        ]);
        failed ||= results.some((result) => result.status === 'rejected');
      }),
    );
    return {
      refreshed: true,
      retryAfter: TRACKING_REFRESH_SECONDS,
      message: !rows.length
        ? 'Shipping details are not available yet.'
        : failed
          ? 'Some tracking updates are unavailable. Your last saved updates are still shown.'
          : 'Tracking checked.',
    };
  } catch {
    failed = true;
    throw new Error('Tracking could not be refreshed. Your saved order is still available.');
  } finally {
    await db.merchizeFulfillmentSyncAttempt.update({
      where: { id: attempt.id },
      data: { status: failed ? 'failed' : 'succeeded', finishedAt: new Date() },
    });
  }
}

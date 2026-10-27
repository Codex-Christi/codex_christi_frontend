import 'server-only';
import { z } from 'zod';
import { countries } from 'country-data-list';
import { merchizeCatalogPrisma as db } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';
import { createStorefrontVerificationContext } from '@/lib/merchizeStorefront/currentProductLineCompatibility';
import { verifyProductForDestination } from '@/lib/merchizeStorefront/productDestinationVerification';
import { supplierEvidenceTtlMs } from '@/lib/merchizeCatalog/currentEvidence';
import { getSavedProductDelivery } from './savedDeliveryData';
import { presentDeliveryStatus, type DeliveryCheckEvent } from './deliveryStatus';
import { normalizeCountryToIso3 } from '@/lib/utils/shop/checkout/normalizeCountryToIso3';

export const deliveryCheckInputSchema = z.object({
  productIds: z.array(z.string().trim().min(1).max(128)).min(1).max(100),
  country: z
    .string()
    .length(3)
    .refine((value) => normalizeCountryToIso3(value) === value),
  force: z.boolean().default(false),
});

export function isSameOriginDeliveryRequest(request: Request) {
  const origin = request.headers.get('origin');
  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0].trim() ??
    request.headers.get('host') ??
    new URL(request.url).host;
  if (!origin || !URL.canParse(origin)) return false;
  const source = new URL(origin);
  return (
    source.host === host &&
    ['http:', 'https:'].includes(source.protocol) &&
    (!request.headers.has('sec-fetch-site') ||
      request.headers.get('sec-fetch-site') === 'same-origin')
  );
}

export async function runDeliveryQueue<T>(
  ids: string[],
  check: (id: string) => Promise<T>,
  settled: (id: string, result: PromiseSettledResult<T>) => Promise<void> | void,
  signal: AbortSignal,
) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, ids.length) }, async () => {
      while (!signal.aborted && next < ids.length) {
        const id = ids[next++];
        const result = await Promise.resolve()
          .then(() => check(id))
          .then(
            (value): PromiseSettledResult<T> => ({ status: 'fulfilled', value }),
            (reason): PromiseSettledResult<T> => ({ status: 'rejected', reason }),
          );
        if (!signal.aborted) await settled(id, result);
      }
    }),
  );
}

export async function checkDeliveryProducts({
  productIds,
  country,
  force,
  signal,
  emit,
}: {
  productIds: string[];
  country: string;
  force: boolean;
  signal: AbortSignal;
  emit: (event: DeliveryCheckEvent) => void;
}) {
  const context = createStorefrontVerificationContext({ forceRefresh: force, signal });
  const countryName = countries.all.find((item) => item.alpha3 === country)!.name;
  const issues = await db.storefrontVariantCompatibility.groupBy({
    by: ['storefrontProductId'],
    where: {
      storefrontProductId: { in: productIds },
      status: { in: ['unavailable', 'unverified'] },
    },
    _count: { _all: true },
  });
  const issueCounts = new Map(issues.map((row) => [row.storefrontProductId, row._count._all]));
  let failed = 0;
  let completed = 0;
  await runDeliveryQueue(
    productIds,
    async (id) => {
      signal.throwIfAborted();
      emit({ type: 'checking', productId: id });
      await verifyProductForDestination(id, country, { context });
      signal.throwIfAborted();
      const [checks, count] = await Promise.all([
        getSavedProductDelivery([id], country),
        db.storefrontVariantCompatibility.count({
          where: { storefrontProductId: id, status: { in: ['unavailable', 'unverified'] } },
        }),
      ]);
      return presentDeliveryStatus(checks.get(id), countryName, count, supplierEvidenceTtlMs());
    },
    (id, result) => {
      const row =
        result.status === 'fulfilled'
          ? result.value
          : presentDeliveryStatus(
              {
                checkedAt: new Date(),
                completed: false,
                availableCount: 0,
                unsupportedCount: 0,
                unverifiedCount: 0,
                reason: 'verification_unavailable',
                stale: false,
                source: 'live',
              },
              countryName,
              issueCounts.get(id) ?? 0,
              supplierEvidenceTtlMs(),
            );
      completed += 1;
      if (row.requiresCheck) failed += 1;
      emit({ type: 'result', productId: id, result: row });
    },
    signal,
  );
  return { completed, failed };
}

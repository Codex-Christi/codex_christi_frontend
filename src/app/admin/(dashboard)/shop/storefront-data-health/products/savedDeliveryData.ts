import 'server-only';
import { z } from 'zod';
import { merchizeCatalogPrisma as db } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';
import type { StorefrontProductDestinationCheck } from '@/lib/prisma/shop/merchize/generated/merchizeCatalog/client';
import {
  readSavedSupplierVariants,
  supplierEvidenceStoreScope,
  supplierEvidenceTtlMs,
} from '@/lib/merchizeCatalog/currentEvidence';
import { evaluateDestinationOptions } from '@/lib/merchizeStorefront/destinationAvailability';
import { loadExtrasBySku } from '@/lib/datasetSearchers/merchize/shipping.data';

const identity = z.string().min(1).max(128);
const savedOptions = z.object({
  storeScope: z.string(),
  options: z
    .array(
      z.object({
        variantId: identity,
        sku: identity,
        supplierProductId: identity,
        supplierVariantId: identity,
      }),
    )
    .max(1_000),
});
type SavedDelivery = Omit<
  StorefrontProductDestinationCheck,
  'merchizeProductId' | 'countryIso3'
> & {
  stale: boolean;
  source: 'catalog' | 'live';
};

/** Diagnostic projection only. Checkout continues to verify live identity, price and delivery. */
export async function getSavedProductDelivery(productIds: string[], countryIso3: string) {
  const [checks, destinationChecks] = await Promise.all([
    db.storefrontProductCheck.findMany({ where: { merchizeProductId: { in: productIds } } }),
    db.storefrontProductDestinationCheck.findMany({
      where: { merchizeProductId: { in: productIds }, countryIso3 },
    }),
  ]);
  const now = Date.now();
  const fresh = (date: Date) => now >= +date && now - +date < supplierEvidenceTtlMs();
  const result = new Map<string, SavedDelivery>(
    destinationChecks.map((check) => [
      check.merchizeProductId,
      { ...check, stale: !fresh(check.checkedAt), source: 'live' },
    ]),
  );
  const parsed = checks.map((check) => ({
    check,
    saved: savedOptions.safeParse(check.supplierOptionsJson),
  }));
  const catalog = await readSavedSupplierVariants(
    parsed.flatMap(({ saved }) =>
      saved.success && saved.data.storeScope === supplierEvidenceStoreScope()
        ? saved.data.options.map((option) => option.sku)
        : [],
    ),
  );
  const extrasBySku = catalog.size ? await loadExtrasBySku() : undefined;
  for (const { check, saved } of parsed) {
    const lastDestination = result.get(check.merchizeProductId);
    if (
      lastDestination &&
      +lastDestination.checkedAt > +check.checkedAt &&
      (!lastDestination.completed || lastDestination.reason === 'verification_unavailable')
    )
      continue;
    if (!check.completed) {
      result.set(check.merchizeProductId, {
        ...check,
        unsupportedCount: 0,
        availableCount: 0,
        reason: 'verification_unavailable',
        stale: !fresh(check.checkedAt),
        source: 'live',
      });
      continue;
    }
    if (!saved.success || saved.data.storeScope !== supplierEvidenceStoreScope()) {
      if (check.supplierOptionsJson !== null) result.delete(check.merchizeProductId);
      continue;
    }
    const options = saved.data.options;
    if (
      options.length !== check.availableCount ||
      new Set(options.map((option) => option.variantId)).size !== options.length
    ) {
      result.delete(check.merchizeProductId);
      continue;
    }
    const rows = options.flatMap((option) => {
      const entry = catalog.get(option.sku);
      return entry &&
        entry.variant.supplierProductId === option.supplierProductId &&
        entry.variant.supplierVariantId === option.supplierVariantId
        ? [entry]
        : [];
    });
    const checkedAt = new Date(Math.min(+check.checkedAt, ...rows.map((row) => +row.verifiedAt)));
    const stale = !fresh(checkedAt);
    const delivery = evaluateDestinationOptions({
      options,
      catalogRows: stale ? [] : rows.map((row) => row.variant.catalogRow),
      countryIso3,
      extrasBySku,
    });
    const availableCount = delivery.availableVariantIds.length;
    const unsupportedCount = delivery.unsupportedVariantIds.length;
    const unverifiedCount = check.unverifiedCount + delivery.unverifiedVariantIds.length;
    result.set(check.merchizeProductId, {
      checkedAt,
      completed: true,
      stale,
      source: 'catalog',
      availableCount,
      unsupportedCount,
      unverifiedCount,
      reason: !check.productAvailable
        ? 'product_unavailable'
        : availableCount
          ? null
          : unverifiedCount
            ? 'verification_unavailable'
            : unsupportedCount
              ? 'shipping_unavailable'
              : 'product_unavailable',
    });
  }
  return result;
}

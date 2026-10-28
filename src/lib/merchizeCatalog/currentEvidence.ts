import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { merchizeCatalogPrisma as db } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';
import { fetchMerchizeJson } from '@/lib/merchizeStorefront/providerErrors';
import { createBoundedProviderReader } from './providerReads';
import type {
  CatalogItem,
  StrictCatalogVariantRecord,
} from '@/lib/datasetSearchers/merchize/catalog';

const identity = z.string().trim().min(1).max(128);
const fee = z.number().finite().nonnegative().nullable().optional();
const bandSchema = z.object({
  to_zone: z.string().min(1).max(16),
  to_country: z.string().max(512).nullable().optional(),
  first_item: fee,
  additional_item: fee,
  first_item_price: fee,
  additional_item_price: fee,
});
const variantSchema = z.object({
  _id: identity,
  sku: identity,
  attributes: z
    .array(
      z.object({
        name: z.string().max(128),
        type: z.string().max(128),
        value_text: z.string().max(128),
        value_code: z.string().max(128),
      }),
    )
    .max(32)
    .nullable()
    .optional(),
  shipping_prices: z.array(bandSchema).max(100).nullable().optional(),
  tiers: z
    .array(z.object({ name: z.string(), price: fee }))
    .max(32)
    .nullable()
    .optional(),
});
const productSchema = z.object({
  _id: identity,
  sku: identity,
  variants: z.array(variantSchema).max(10_000),
});
const pageSchema = z.object({
  success: z.literal(true),
  data: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive().max(50),
    total: z.number().int().nonnegative().max(200),
    products: z.array(productSchema).max(50),
  }),
});
export type SupplierProductEvidence = z.infer<typeof productSchema>;
export type SupplierShippingBand = z.infer<typeof bandSchema>;
export type SupplierProductHint = { productSku: string; supplierProductId?: string };
type StoredEvidence = { product: SupplierProductEvidence | null; verifiedAt: Date };
export type DemandCatalogBatch = {
  generationAvailable: boolean;
  unverifiedSkus: string[];
  variants: StrictCatalogVariantRecord[];
};
export type SupplierEvidenceDependencies = {
  signal?: AbortSignal;
  read: (productSku: string) => Promise<StoredEvidence | null>;
  write: (productSku: string, value: StoredEvidence) => Promise<void>;
  locate: (skus: string[]) => Promise<Map<string, SupplierProductHint>>;
  fetchPage: (queries: string[], page: number) => Promise<unknown>;
  now?: () => Date;
  ttlMs?: number;
  forceRefresh?: boolean;
};

export function supplierEvidenceTtlMs() {
  const value = Number(process.env.MERCHIZE_CATALOG_CURRENT_MAX_AGE_HOURS ?? 48);
  return (Number.isFinite(value) ? Math.min(336, Math.max(1, value)) : 48) * 3_600_000;
}

export function supplierVariantRecord(
  product: SupplierProductEvidence,
  variant: SupplierProductEvidence['variants'][number],
): StrictCatalogVariantRecord {
  const bands = variant.shipping_prices ?? [];
  const row: CatalogItem = {
    SKU_product: product.sku,
    SKU_variant: variant.sku,
    tier_1_price: variant.tiers?.find((t) => t.name === 'tier1')?.price ?? null,
    tier_2_price: variant.tiers?.find((t) => t.name === 'tier2')?.price ?? null,
    tier_3_price: variant.tiers?.find((t) => t.name === 'tier3')?.price ?? null,
    US_shipping_fee: null,
    US_additional_shipping_fee: null,
    EU_shipping_fee: null,
    EU_additional_shipping_fee: null,
    GB_shipping_fee: null,
    GB_additional_shipping_fee: null,
    CA_shipping_fee: null,
    CA_additional_shipping_fee: null,
    AU_shipping_fee: null,
    AU_additional_shipping_fee: null,
    ROW_shipping_fee: null,
    ROW_additional_shipping_fee: null,
    shippingBands: Array.isArray(variant.shipping_prices) ? bands : undefined,
  };
  for (const band of bands) {
    if (band.to_country && band.to_country.toLowerCase() !== 'all') continue;
    const zone = band.to_zone as 'US' | 'EU' | 'GB' | 'CA' | 'AU' | 'ROW';
    if (!['US', 'EU', 'GB', 'CA', 'AU', 'ROW'].includes(zone)) continue;
    row[`${zone}_shipping_fee`] = band.first_item ?? band.first_item_price ?? null;
    row[`${zone}_additional_shipping_fee`] =
      band.additional_item ?? band.additional_item_price ?? null;
  }
  return {
    sku: variant.sku,
    supplierProductId: product._id,
    supplierVariantId: variant._id,
    catalogRow: row,
  };
}

// One operation shares queries across products, pricing, and shipping, without caching live prices.
export function createSupplierEvidenceResolver(deps: SupplierEvidenceDependencies) {
  const queries = new Map<string, Promise<SupplierProductEvidence[]>>();
  const hints = new Map<string, SupplierProductHint>();
  const now = deps.now ?? (() => new Date());
  async function query(productSku: string, discovery = false) {
    const key = `${discovery ? 'discover' : 'exact'}:${productSku}`;
    let task = queries.get(key);
    if (!task) {
      task = (async () => {
        deps.signal?.throwIfAborted();
        if (!discovery && !deps.forceRefresh) {
          const saved = await deps.read(productSku).catch(() => null);
          const age = saved ? now().getTime() - saved.verifiedAt.getTime() : Infinity;
          const ttl = saved?.product ? (deps.ttlMs ?? supplierEvidenceTtlMs()) : 60_000;
          if (saved && age >= 0 && age < ttl) return saved.product ? [saved.product] : [];
        }
        const observedAt = now();
        const products: SupplierProductEvidence[] = [];
        let expectedTotal: number | null = null;
        for (let page = 1; page <= 4; page += 1) {
          deps.signal?.throwIfAborted();
          const response = pageSchema.parse(await deps.fetchPage([productSku], page)).data;
          if (
            response.page !== page ||
            (expectedTotal !== null && expectedTotal !== response.total)
          ) {
            throw new Error('Supplier catalog pagination changed during verification.');
          }
          expectedTotal = response.total;
          products.push(...response.products);
          if (products.length >= response.total) break;
          if (!response.products.length || page === 4)
            throw new Error('Supplier catalog search is incomplete.');
        }
        if (products.length !== expectedTotal)
          throw new Error('Supplier catalog returned incomplete coverage.');
        const seenProducts = new Set<string>();
        const seenVariants = new Set<string>();
        const seenSkus = new Set<string>();
        for (const product of products) {
          if (seenProducts.has(product.sku))
            throw new Error('Supplier catalog returned duplicate products.');
          seenProducts.add(product.sku);
          for (const variant of product.variants) {
            if (seenVariants.has(variant._id) || seenSkus.has(variant.sku))
              throw new Error('Supplier catalog returned ambiguous variants.');
            seenVariants.add(variant._id);
            seenSkus.add(variant.sku);
          }
        }
        const relevant = discovery ? products : products.filter((p) => p.sku === productSku);
        deps.signal?.throwIfAborted();
        for (const product of relevant) {
          await deps.write(product.sku, { product, verifiedAt: observedAt }).catch(() => {
            console.warn(
              '[merchize.supplierEvidence] cache write failed; using verified live evidence',
            );
          });
        }
        if (!discovery && !relevant.length) {
          await deps
            .write(productSku, { product: null, verifiedAt: observedAt })
            .catch(() => undefined);
        }
        return relevant;
      })();
      queries.set(key, task);
    }
    return task;
  }
  return {
    remember(
      product: SupplierProductEvidence | { _id?: unknown; sku?: unknown; variants?: unknown },
    ) {
      if (typeof product.sku !== 'string' || !Array.isArray(product.variants)) return;
      for (const raw of product.variants) {
        const variant = raw as { sku?: unknown };
        if (typeof variant?.sku === 'string')
          hints.set(variant.sku, {
            productSku: product.sku,
            supplierProductId: typeof product._id === 'string' ? product._id : undefined,
          });
      }
    },
    async resolve(rawSkus: string[]): Promise<DemandCatalogBatch> {
      deps.signal?.throwIfAborted();
      const skus = [...new Set(rawSkus.map((s) => identity.parse(s)))];
      if (skus.length > 1_000) throw new Error('Supplier SKU lookup exceeds its limit.');
      const unknown = skus.filter((sku) => !hints.has(sku));
      const locations = unknown.length
        ? await deps.locate(unknown).catch(() => new Map<string, SupplierProductHint>())
        : new Map<string, SupplierProductHint>();
      const grouped = new Map<string, { discovery: boolean; skus: string[] }>();
      for (const sku of skus) {
        const hint = hints.get(sku) ?? locations.get(sku);
        // A prefix is a bounded search hint only, never positive identity or negative SKU proof.
        const querySku = hint?.productSku ?? sku.slice(0, 6);
        const key = `${hint ? 'exact' : 'discover'}:${querySku}`;
        const group = grouped.get(key) ?? { discovery: !hint, skus: [] };
        group.skus.push(sku);
        grouped.set(key, group);
      }
      if (grouped.size > 32) throw new Error('Supplier product lookup exceeds its limit.');
      const variants: StrictCatalogVariantRecord[] = [];
      const unverifiedSkus: string[] = [];
      // Small batches avoid an unbounded burst even when every SKU has a different parent.
      const entries = [...grouped.entries()];
      for (let offset = 0; offset < entries.length; offset += 4) {
        await Promise.all(
          entries.slice(offset, offset + 4).map(async ([key, group]) => {
            try {
              const products = await query(key.slice(key.indexOf(':') + 1), group.discovery);
              for (const sku of group.skus) {
                const matches = products.flatMap((product) =>
                  product.variants
                    .filter((v) => v.sku === sku)
                    .map((variant) => ({ product, variant })),
                );
                if (matches.length === 1)
                  variants.push(supplierVariantRecord(matches[0].product, matches[0].variant));
                else if (group.discovery || matches.length > 1) unverifiedSkus.push(sku);
              }
            } catch {
              unverifiedSkus.push(...group.skus);
            }
          }),
        );
      }
      return { generationAvailable: unverifiedSkus.length === 0, unverifiedSkus, variants };
    },
  };
}

const boundedProviderRead = createBoundedProviderReader();

export function supplierEvidenceStoreScope() {
  return `${process.env.MERCHIZE_CATALOG_URL ?? ''}|${process.env.MERCHIZE_STORE_SLUG ?? '27mkjsl'}`;
}

/** Admin previews only: a bounded SQLite read that never renews supplier evidence. */
export async function readSavedSupplierVariants(skus: string[]) {
  const unique = [...new Set(skus)];
  const scope = supplierEvidenceStoreScope();
  const evidenceIds = new Set<string>();
  for (let offset = 0; offset < unique.length; offset += 400) {
    const links = await db.supplierCatalogVariantEvidence.findMany({
      where: { storeScope: scope, sku: { in: unique.slice(offset, offset + 400) } },
      select: { productEvidenceId: true },
    });
    for (const link of links) evidenceIds.add(link.productEvidenceId);
  }
  const result = new Map<string, { variant: StrictCatalogVariantRecord; verifiedAt: Date }>();
  const requested = new Set(unique);
  const ids = [...evidenceIds];
  for (let offset = 0; offset < ids.length; offset += 400) {
    const rows = await db.supplierCatalogProductEvidence.findMany({
      where: { storeScope: scope, id: { in: ids.slice(offset, offset + 400) } },
    });
    for (const row of rows) {
      const payload = row.payloadJson as { product?: unknown } | null;
      const parsed = productSchema.safeParse(payload?.product);
      if (!parsed.success || parsed.data.sku !== row.productSku) continue;
      for (const variant of parsed.data.variants) {
        if (requested.has(variant.sku))
          result.set(variant.sku, {
            variant: supplierVariantRecord(parsed.data, variant),
            verifiedAt: row.verifiedAt,
          });
      }
    }
  }
  return result;
}

export function createDemandCatalogResolver(
  options: { forceRefresh?: boolean; signal?: AbortSignal } = {},
) {
  const baseUrl = process.env.MERCHIZE_CATALOG_URL;
  const scope = supplierEvidenceStoreScope();
  const keyFor = (sku: string) => createHash('sha256').update(`${scope}|${sku}`).digest('hex');
  return createSupplierEvidenceResolver({
    forceRefresh: options.forceRefresh,
    signal: options.signal,
    async read(productSku) {
      const row = await db.supplierCatalogProductEvidence.findUnique({
        where: { id: keyFor(productSku) },
      });
      if (!row) return null;
      const value = row.payloadJson as { product: unknown };
      const product = value.product === null ? null : productSchema.parse(value.product);
      if (product && product.sku !== productSku) return null;
      return { product, verifiedAt: row.verifiedAt };
    },
    async write(productSku, value) {
      const id = keyFor(productSku);
      await db.$transaction(async (tx) => {
        const existing = await tx.supplierCatalogProductEvidence.findUnique({
          where: { id },
          select: { verifiedAt: true },
        });
        if (existing && existing.verifiedAt > value.verifiedAt) return;
        await tx.supplierCatalogProductEvidence.upsert({
          where: { id },
          create: {
            id,
            storeScope: scope,
            productSku,
            payloadJson: { product: value.product },
            verifiedAt: value.verifiedAt,
          },
          update: { payloadJson: { product: value.product }, verifiedAt: value.verifiedAt },
        });
        await tx.supplierCatalogVariantEvidence.deleteMany({ where: { productEvidenceId: id } });
        const variants = value.product?.variants ?? [];
        for (let offset = 0; offset < variants.length; offset += 250) {
          await tx.supplierCatalogVariantEvidence.createMany({
            data: variants.slice(offset, offset + 250).map((v) => ({
              id: keyFor(v.sku),
              storeScope: scope,
              sku: v.sku,
              productEvidenceId: id,
            })),
          });
        }
      });
    },
    async locate(skus) {
      const result = new Map<string, SupplierProductHint>();
      const [saved, historical] = await Promise.all([
        db.supplierCatalogVariantEvidence
          .findMany({
            where: { storeScope: scope, sku: { in: skus } },
            select: { sku: true, productEvidence: { select: { productSku: true } } },
          })
          .catch(() => []),
        db.variant
          .findMany({
            where: { sku: { in: skus } },
            select: { sku: true, product: { select: { skuPrefix: true } } },
          })
          .catch(() => []),
      ]);
      for (const row of historical)
        if (row.product?.skuPrefix) result.set(row.sku, { productSku: row.product.skuPrefix });
      for (const row of saved) result.set(row.sku, { productSku: row.productEvidence.productSku });
      return result;
    },
    async fetchPage(queries, page) {
      if (!baseUrl || !process.env.MERCHIZE_API_KEY)
        throw new Error('Supplier catalog credentials are unavailable.');
      const url = new URL(baseUrl);
      url.searchParams.set('search', queries.join(','));
      url.searchParams.set('page', String(page));
      url.searchParams.set('limit', '50');
      return boundedProviderRead(
        `${scope}|${url.search}`,
        (signal) =>
          fetchMerchizeJson(
            url.toString(),
            {
              headers: { 'X-API-KEY': process.env.MERCHIZE_API_KEY! },
              cache: 'no-store',
              signal,
            },
            { timeoutMs: 15_000 },
          ),
        options.signal,
      );
    },
  });
}

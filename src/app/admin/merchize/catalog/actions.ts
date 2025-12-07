// src/app/admin/merchize/catalog/actions.ts
'use server';

import { merchizeCatalogPrisma } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';
import { refreshMerchizeCatalog } from '@/lib/merchizeCatalog/sync';

const v = await merchizeCatalogPrisma.variant.findUnique({
  where: { sku: 'FBJSVN000000AA02' },
  select: {
    sku: true,
    tier1Price: true,
    tier2Price: true,
    tier3Price: true,
    shippingBands: true,
    tiersJson: true,
  },
});

console.log('>>> Inspect variant FBJSVN000000AA02', v);

export async function refreshAction() {
  try {
    const result = await refreshMerchizeCatalog();

    const syncState = await merchizeCatalogPrisma.syncState.findUnique({
      where: { id: 'merchize_catalog' },
    });

    return {
      ok: true as const,
      ingestedVariants: result.ingestedVariants,
      totalProducts: result.totalProducts,
      syncState,
    };
  } catch (e: unknown) {
    console.error('[MerchizeCatalog] refreshAction error', e);
    const message = e instanceof Error ? e.message : 'Unknown error while refreshing catalog';
    return {
      ok: false as const,
      error: message,
    };
  }
}

export async function searchCatalogBySku(query: string) {
  const q = query.trim();
  if (!q) {
    return { ok: false as const, message: 'Enter a SKU or partial SKU' };
  }

  try {
    const variants = await merchizeCatalogPrisma.variant.findMany({
      where: { sku: { contains: q } }, // Prisma SQLite StringFilter: no `mode`
      include: { product: true, shippingBands: true },
      take: 10,
    });

    return { ok: true as const, variants };
  } catch (e: unknown) {
    console.error('[MerchizeCatalog] searchCatalogBySku error', e);
    const message = e instanceof Error ? e.message : 'Unknown error while searching catalog';
    return { ok: false as const, message };
  }
}

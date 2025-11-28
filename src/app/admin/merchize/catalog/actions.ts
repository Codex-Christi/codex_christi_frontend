// src/app/admin/merchize/catalog/actions.ts
'use server';

import { merchizeCatalogPrisma } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';
import { refreshMerchizeCatalog } from '@/lib/merchizeCatalog/sync';

export async function refreshAction() {
  try {
    const result = await refreshMerchizeCatalog();

    console.log(`---RESPONSE from [refreshAction()] server action \n`);

    console.dir(result, { depth: 1 });
    console.log('\n');

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
    const message = e instanceof Error ? e.message : 'Unknown error while refreshing catalog';
    console.dir(e, { depth: null });
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

  const variants = await merchizeCatalogPrisma.variant.findMany({
    where: { sku: { contains: q } }, // Prisma SQLite StringFilter: no `mode`
    include: { product: true, shippingBands: true },
    take: 10,
  });

  return { ok: true as const, variants };
}

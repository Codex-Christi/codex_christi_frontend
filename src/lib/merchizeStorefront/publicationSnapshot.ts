import 'server-only';
import { cache } from 'react';
import { merchizeCatalogPrisma as db } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';
import { PUBLISHED_SHOP_PRODUCT_IDS } from '@/lib/utils/shopHomePageProductsData';
import { isStorefrontProductUnpublished } from './publication';

export async function getUnpublishedStorefrontProductIds(productIds: readonly string[]) {
  if (!productIds.length) return new Set<string>();
  const rows = await db.storefrontProductSnapshot.findMany({
    where: { merchizeProductId: { in: [...productIds] } },
    select: { merchizeProductId: true, rawProductJson: true },
  });
  return new Set(
    rows
      .filter((row) => isStorefrontProductUnpublished(row.rawProductJson))
      .map((row) => row.merchizeProductId),
  );
}

export const getUnpublishedHomeProductIds = cache(async () =>
  getUnpublishedStorefrontProductIds(PUBLISHED_SHOP_PRODUCT_IDS).catch(() => new Set<string>()),
);

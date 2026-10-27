import 'server-only';
import { merchizeCatalogPrisma } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';
import { PUBLISHED_SHOP_PRODUCT_IDS } from '@/lib/utils/shopHomePageProductsData';
import { STOREFRONT_SNAPSHOT_CATEGORY_SLUGS } from './categories';

export async function getManagedStorefrontProductIds() {
  const rows = await merchizeCatalogPrisma.storefrontCategoryProduct.findMany({
    where: { category: { categorySlug: { in: [...STOREFRONT_SNAPSHOT_CATEGORY_SLUGS] } } },
    select: { product: { select: { merchizeProductId: true } } },
  });
  return [
    ...new Set([
      ...PUBLISHED_SHOP_PRODUCT_IDS,
      ...rows.map((row) => row.product.merchizeProductId),
    ]),
  ].sort();
}

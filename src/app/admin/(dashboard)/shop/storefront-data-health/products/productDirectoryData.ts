import 'server-only';
import { countries } from 'country-data-list';
import { merchizeCatalogPrisma as db } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';
import { getManagedStorefrontProductIds } from '@/lib/merchizeStorefront/managedProducts';
import { toMerchizeProductPreviewUrl } from '@/lib/merchizeStorefront/imageUrls';
import { readProductDirectoryFilters } from './filters';
import { getSavedProductDelivery } from './savedDeliveryData';
import { supplierEvidenceTtlMs } from '@/lib/merchizeCatalog/currentEvidence';
import { presentDeliveryStatus } from './deliveryStatus';

export async function getStorefrontProductDirectory(
  params: Record<string, string | string[] | undefined>,
  defaultCountry?: string | null,
) {
  const managedIds = await getManagedStorefrontProductIds();
  const filters = readProductDirectoryFilters(params, defaultCountry);
  const countryName =
    countries.all.find((country) => country.alpha3 === filters.country)?.name ?? filters.country;
  const issues = await db.storefrontVariantCompatibility.groupBy({
    by: ['storefrontProductId'],
    where: {
      storefrontProductId: { in: managedIds },
      status: { in: ['unavailable', 'unverified'] },
    },
    _count: { _all: true },
  });
  const where = {
    merchizeProductId: { in: managedIds },
    ...(filters.query
      ? {
          OR: [
            { title: { contains: filters.query } },
            { merchizeProductId: { contains: filters.query } },
          ],
        }
      : {}),
  };
  const products = await db.storefrontProductSnapshot.findMany({
    where,
    orderBy: [{ title: 'asc' }, { merchizeProductId: 'asc' }],
    select: { merchizeProductId: true, title: true, image: true },
  });
  const checks = await getSavedProductDelivery(
    products.map((product) => product.merchizeProductId),
    filters.country,
  );
  const issueCounts = new Map(
    issues.map((issue) => [issue.storefrontProductId, issue._count._all]),
  );
  const results = products.map((product) => {
    const check = checks.get(product.merchizeProductId);
    const optionCount = issueCounts.get(product.merchizeProductId) ?? 0;
    return {
      productId: product.merchizeProductId,
      title: product.title || 'Product details not saved',
      image: toMerchizeProductPreviewUrl(product.image),
      country: filters.country,
      countryName,
      ...presentDeliveryStatus(check, countryName, optionCount, supplierEvidenceTtlMs()),
    };
  });
  return { rows: results, countryName, filters };
}

export type StorefrontDirectoryRow = Awaited<
  ReturnType<typeof getStorefrontProductDirectory>
>['rows'][number];

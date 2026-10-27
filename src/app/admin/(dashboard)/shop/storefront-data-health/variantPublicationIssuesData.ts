import 'server-only';

import type { Prisma } from '@/lib/prisma/shop/merchize/generated/merchizeCatalog/client';
import { merchizeCatalogPrisma } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';
import { getManagedStorefrontProductIds } from '@/lib/merchizeStorefront/managedProducts';

const OPEN_VARIANT_PUBLICATION_STATUSES = ['unavailable', 'unverified'] as const;
const VARIANT_PUBLICATION_ISSUE_PAGE_SIZE = 50;

const variantPublicationIssueSelect = {
  id: true,
  storefrontProductId: true,
  storefrontVariantId: true,
  storefrontProductTitle: true,
  storefrontSku: true,
  supplierProductId: true,
  supplierVariantId: true,
  supplierSku: true,
  productLineName: true,
  selectedOptionsJson: true,
  providerEvidenceJson: true,
  status: true,
  reasonCode: true,
  occurrenceCount: true,
  incidentEpisode: true,
  firstObservedAt: true,
  lastObservedAt: true,
  resolvedAt: true,
} satisfies Prisma.StorefrontVariantCompatibilitySelect;

export type VariantPublicationIssue = Prisma.StorefrontVariantCompatibilityGetPayload<{
  select: typeof variantPublicationIssueSelect;
}>;

export type VariantPublicationIssueSummary = {
  openIssueCount: number;
  unavailableIssueCount: number;
  unverifiedIssueCount: number;
  storageError: string | null;
  products: Array<{
    productId: string;
    title: string;
    optionCount: number;
    reasons: string[];
    lastObservedAt: Date;
  }>;
};

export type VariantPublicationIssueQueue = Omit<VariantPublicationIssueSummary, 'products'> & {
  productId?: string;
  openIssues: VariantPublicationIssue[];
  recentlyResolvedIssues: VariantPublicationIssue[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  pageStart: number;
  pageEnd: number;
};

async function getIssueCounts() {
  const managedIds = await getManagedStorefrontProductIds();
  const statusCounts = await merchizeCatalogPrisma.storefrontVariantCompatibility.groupBy({
    by: ['status'],
    where: {
      status: { in: [...OPEN_VARIANT_PUBLICATION_STATUSES] },
      storefrontProductId: { in: managedIds },
    },
    _count: { _all: true },
  });
  const unavailableIssueCount =
    statusCounts.find(({ status }) => status === 'unavailable')?._count._all ?? 0;
  const unverifiedIssueCount =
    statusCounts.find(({ status }) => status === 'unverified')?._count._all ?? 0;

  return {
    openIssueCount: unavailableIssueCount + unverifiedIssueCount,
    unavailableIssueCount,
    unverifiedIssueCount,
  };
}

function unavailableSummary(): VariantPublicationIssueSummary {
  return {
    openIssueCount: 0,
    unavailableIssueCount: 0,
    unverifiedIssueCount: 0,
    storageError: 'Variant compatibility storage is unavailable.',
    products: [],
  };
}

export async function getVariantPublicationIssueSummary(): Promise<VariantPublicationIssueSummary> {
  try {
    const counts = await getIssueCounts();
    const managedIds = await getManagedStorefrontProductIds();
    const rows = await merchizeCatalogPrisma.storefrontVariantCompatibility.findMany({
      where: {
        storefrontProductId: { in: managedIds },
        status: { in: [...OPEN_VARIANT_PUBLICATION_STATUSES] },
      },
      select: {
        storefrontProductId: true,
        storefrontProductTitle: true,
        reasonCode: true,
        lastObservedAt: true,
      },
      orderBy: { lastObservedAt: 'desc' },
    });
    const products = new Map<string, VariantPublicationIssueSummary['products'][number]>();
    for (const row of rows) {
      const product = products.get(row.storefrontProductId) ?? {
        productId: row.storefrontProductId,
        title: row.storefrontProductTitle ?? row.storefrontProductId,
        optionCount: 0,
        reasons: [],
        lastObservedAt: row.lastObservedAt,
      };
      product.optionCount += 1;
      if (!product.reasons.includes(row.reasonCode)) product.reasons.push(row.reasonCode);
      products.set(product.productId, product);
    }

    return {
      ...counts,
      storageError: null,
      products: [...products.values()].sort((a, b) => b.optionCount - a.optionCount),
    };
  } catch (error) {
    console.error('Failed to fetch storefront variant publication issue summary:', error);
    return unavailableSummary();
  }
}

export async function getVariantPublicationIssueQueue(
  requestedPage = 1,
  productId?: string,
): Promise<VariantPublicationIssueQueue> {
  try {
    if (productId && !(await getManagedStorefrontProductIds()).includes(productId))
      throw new Error('Product is outside the managed storefront.');
    const counts = productId ? await getIssueCountsForProduct(productId) : await getIssueCounts();
    const scopeIds = productId ? [productId] : await getManagedStorefrontProductIds();
    const totalPages = Math.max(
      1,
      Math.ceil(counts.openIssueCount / VARIANT_PUBLICATION_ISSUE_PAGE_SIZE),
    );
    const normalizedRequestedPage =
      Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const currentPage = Math.min(normalizedRequestedPage, totalPages);
    const [openIssues, recentlyResolvedIssues] = await Promise.all([
      merchizeCatalogPrisma.storefrontVariantCompatibility.findMany({
        where: {
          status: { in: [...OPEN_VARIANT_PUBLICATION_STATUSES] },
          storefrontProductId: { in: scopeIds },
        },
        select: variantPublicationIssueSelect,
        orderBy: [{ lastObservedAt: 'desc' }, { id: 'desc' }],
        skip: (currentPage - 1) * VARIANT_PUBLICATION_ISSUE_PAGE_SIZE,
        take: VARIANT_PUBLICATION_ISSUE_PAGE_SIZE,
      }),
      merchizeCatalogPrisma.storefrontVariantCompatibility.findMany({
        where: {
          status: 'resolved',
          resolvedAt: { not: null },
          storefrontProductId: { in: scopeIds },
        },
        select: variantPublicationIssueSelect,
        orderBy: [{ resolvedAt: 'desc' }, { id: 'desc' }],
        take: 20,
      }),
    ]);
    const pageStart = counts.openIssueCount
      ? (currentPage - 1) * VARIANT_PUBLICATION_ISSUE_PAGE_SIZE + 1
      : 0;
    const pageEnd = Math.min(
      currentPage * VARIANT_PUBLICATION_ISSUE_PAGE_SIZE,
      counts.openIssueCount,
    );

    return {
      productId,
      openIssues,
      recentlyResolvedIssues,
      ...counts,
      storageError: null,
      currentPage,
      totalPages,
      pageSize: VARIANT_PUBLICATION_ISSUE_PAGE_SIZE,
      pageStart,
      pageEnd,
    };
  } catch (error) {
    console.error('Failed to fetch storefront variant publication issue queue:', error);
    return {
      ...unavailableSummary(),
      openIssues: [],
      recentlyResolvedIssues: [],
      currentPage: 1,
      totalPages: 1,
      pageSize: VARIANT_PUBLICATION_ISSUE_PAGE_SIZE,
      pageStart: 0,
      pageEnd: 0,
    };
  }
}

async function getIssueCountsForProduct(productId: string) {
  const groups = await merchizeCatalogPrisma.storefrontVariantCompatibility.groupBy({
    by: ['status'],
    where: {
      storefrontProductId: productId,
      status: { in: [...OPEN_VARIANT_PUBLICATION_STATUSES] },
    },
    _count: { _all: true },
  });
  const unavailableIssueCount = groups.find((g) => g.status === 'unavailable')?._count._all ?? 0;
  const unverifiedIssueCount = groups.find((g) => g.status === 'unverified')?._count._all ?? 0;
  return {
    openIssueCount: unavailableIssueCount + unverifiedIssueCount,
    unavailableIssueCount,
    unverifiedIssueCount,
  };
}

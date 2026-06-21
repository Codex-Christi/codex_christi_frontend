import type { Metadata } from 'next';
import MerchizeCatalogSnapshotsAdminClient from './MerchizeCatalogSnapshotsAdminClient';
import { getStorefrontSnapshotStats } from './actions';
import { merchizeCatalogPrisma } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';
import { requireAdminPage } from '@/lib/admin/require-admin';

export const metadata: Metadata = {
  title: 'Merchize Catalog & Snapshots | Codex Christi Admin',
  description: 'Shop admin tooling for Merchize price, shipping, and storefront snapshot data.',
};

export const dynamic = 'force-dynamic';

async function getCatalogPageData() {
  try {
    const [syncState, sampleVariants, storefrontSnapshotStats] = await Promise.all([
      merchizeCatalogPrisma.syncState.findUnique({
        where: { id: 'merchize_catalog' },
      }),
      merchizeCatalogPrisma.variant.findMany({
        include: { product: true, shippingBands: true },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
      getStorefrontSnapshotStats(),
    ]);

    return { syncState, sampleVariants, storefrontSnapshotStats };
  } catch (error) {
    console.error('Failed to fetch catalog data:', error);
    return null;
  }
}

export default async function MerchizeCatalogSnapshotsAdminPage() {
  await requireAdminPage({
    scope: 'shop.view',
    returnPath: '/admin/shop/merchize-catalog-snapshots',
  });

  const pageData = await getCatalogPageData();

  return (
    <>
      {pageData ? (
        <MerchizeCatalogSnapshotsAdminClient
          initialSyncState={pageData.syncState}
          initialSamples={pageData.sampleVariants}
          initialStorefrontSnapshotStats={pageData.storefrontSnapshotStats}
        />
      ) : (
        <div className='grid min-h-[60dvh] place-items-center px-4 text-white'>
          <div className='rounded-lg border border-rose-300/20 bg-rose-400/10 p-5 text-sm text-rose-100 supports-[backdrop-filter]:backdrop-blur-xl'>
            Error loading Merchize catalog and snapshot data.
          </div>
        </div>
      )}
    </>
  );
}

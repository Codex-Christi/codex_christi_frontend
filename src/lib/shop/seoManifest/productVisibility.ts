import type { Metadata } from 'next';
import { merchizeCatalogPrisma as db } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';
import { isStorefrontProductUnpublished } from '@/lib/merchizeStorefront/publication';

export async function getUnpublishedProductMetadata(lookup: string): Promise<Metadata | null> {
  const snapshot = await db.storefrontProductSnapshot.findFirst({
    where: { OR: [{ merchizeProductId: lookup }, { slug: lookup }] },
    select: { rawProductJson: true },
  });
  if (!isStorefrontProductUnpublished(snapshot?.rawProductJson)) return null;
  return {
    title: 'Product not available | Codex Christi Shop',
    description: 'This product is not available.',
    robots: { index: false, follow: false },
    openGraph: {
      title: 'Product not available',
      description: 'This product is not available.',
      images: [],
    },
    twitter: {
      title: 'Product not available',
      description: 'This product is not available.',
      images: [],
    },
  };
}

import 'server-only';

import { getBasicProductFromSnapshot } from '@/lib/merchizeStorefront/snapshot';
import { getPublishedShopProductPreview } from '@/lib/utils/shopHomePageProductsData';
import { toMerchizeThumbnailUrl } from '@/lib/merchizeStorefront/imageUrls';
import type { WishlistProduct } from './types';

export async function resolveWishlistProduct(productId: string): Promise<WishlistProduct> {
  const metadata = await getBasicProductFromSnapshot(productId).catch(() => null);
  const preview = getPublishedShopProductPreview(productId);
  const rawPrice = metadata?.retail_price ?? preview?.retailPrice;
  const parsedPrice = rawPrice == null || rawPrice === '' ? null : Number(rawPrice);
  const rawImage = metadata?.image ?? preview?.imagePath;
  const image = rawImage
    ? rawImage.startsWith('/')
      ? rawImage
      : toMerchizeThumbnailUrl(rawImage)
    : null;

  return {
    productId,
    ...(metadata?.slug ? { slug: metadata.slug } : {}),
    title: metadata?.title || preview?.title || 'Saved product',
    image,
    price:
      parsedPrice !== null && Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : null,
    available: Boolean(
      (metadata || preview) &&
      metadata?.is_active !== false &&
      !metadata?.is_deleted &&
      !metadata?.is_private &&
      !metadata?.is_taken_down,
    ),
  };
}

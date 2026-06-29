import {
  toMerchizeImageUrl,
  toMerchizeProductPreviewUrl,
} from '@/lib/merchizeStorefront/imageUrls';
import type {
  BasicProductInterface,
  ProductVariantsInterface,
} from '@/lib/merchizeStorefront/productTypes';

type ProductVariant = ProductVariantsInterface['data'][number];

export function getVariantGalleryImageUrls(variant: ProductVariant | null | undefined) {
  return (variant?.image_uris ?? []).map((uri) => toMerchizeImageUrl(uri)).filter(Boolean);
}

export function getDefaultVariantGalleryImageUrls(
  variants: ProductVariantsInterface['data'] | null | undefined,
) {
  const previewVariant =
    variants?.find((variant) => variant.is_default && variant.image_uris.length > 0) ??
    variants?.find((variant) => variant.image_uris.length > 0);

  return getVariantGalleryImageUrls(previewVariant);
}

export function resolveProductGalleryImages({
  metadata,
  initialImageUrls,
  variants,
}: {
  metadata?: BasicProductInterface['data'];
  initialImageUrls?: string[];
  variants?: ProductVariantsInterface['data'];
}) {
  const variantImages = getDefaultVariantGalleryImageUrls(variants);
  if (variantImages.length) return variantImages;

  const safeInitialImages = (initialImageUrls ?? [])
    .map((imageUrl) => toMerchizeProductPreviewUrl(imageUrl))
    .filter(Boolean);
  if (safeInitialImages.length) return safeInitialImages;

  const fallback = toMerchizeProductPreviewUrl(metadata?.image);
  return fallback ? [fallback] : [];
}

const MERCHIZE_IMAGE_CDN_BASE = 'https://d2dytk4tvgwhb4.cloudfront.net';
const IMAGE_EXTENSION_PATTERN = /\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i;
const LEGACY_PRODUCT_MOCKUP_PATH_PATTERN =
  /(?:^|\/)products\/[^/]+\/front(?:\/thumb\.jpg)?(?:[?#].*)?$/i;

export function toMerchizeImageUrl(imagePath: string | null | undefined) {
  const normalizedPath = imagePath?.trim();
  if (!normalizedPath) return '';

  return normalizedPath.startsWith('http')
    ? normalizedPath
    : `${MERCHIZE_IMAGE_CDN_BASE}/${normalizedPath.replace(/^\/+/, '')}`;
}

export function toMerchizeThumbnailUrl(imagePath: string | null | undefined) {
  const imageUrl = toMerchizeImageUrl(imagePath);
  if (!imageUrl || IMAGE_EXTENSION_PATTERN.test(imageUrl)) return imageUrl;

  return `${imageUrl.replace(/\/+$/, '')}/thumb.jpg`;
}

export function isLegacyMerchizeProductMockupUrl(imagePath: string | null | undefined) {
  const imageUrl = toMerchizeImageUrl(imagePath);
  return LEGACY_PRODUCT_MOCKUP_PATH_PATTERN.test(imageUrl);
}

export function toMerchizeProductPreviewUrl(imagePath: string | null | undefined) {
  const imageUrl = toMerchizeImageUrl(imagePath);
  if (!imageUrl || isLegacyMerchizeProductMockupUrl(imageUrl)) return '';
  return imageUrl;
}

export function firstStringValue(values: unknown) {
  return Array.isArray(values)
    ? values.find((value): value is string => typeof value === 'string')
    : null;
}

type ImageVariant = { is_default?: boolean; image_uris?: unknown };
type ImageMetadata = { image?: unknown; gallery_uris?: unknown };

function productImageUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const image = value.trim();
  if (isLegacyMerchizeProductMockupUrl(image)) return '';
  if (image.startsWith('/') && !image.startsWith('//')) return image;
  return toMerchizeThumbnailUrl(image);
}

function productImageUrls(values: unknown) {
  return Array.isArray(values) ? [...new Set(values.map(productImageUrl).filter(Boolean))] : [];
}

export function getVariantGalleryImageUrls(variant: ImageVariant | null | undefined) {
  return productImageUrls(variant?.image_uris);
}

export function resolveProductGalleryImages({
  metadata,
  initialImageUrls,
  variants,
  fallbackImageUrl,
}: {
  metadata?: ImageMetadata;
  initialImageUrls?: readonly string[];
  variants?: readonly ImageVariant[] | null;
  fallbackImageUrl?: string | null;
}) {
  const defaultImages = getVariantGalleryImageUrls(
    variants?.find((variant) => variant.is_default && getVariantGalleryImageUrls(variant).length),
  );
  if (defaultImages.length) return defaultImages;
  for (const variant of variants ?? []) {
    const images = getVariantGalleryImageUrls(variant);
    if (images.length) return images;
  }

  for (const source of [
    initialImageUrls,
    metadata?.gallery_uris,
    [metadata?.image],
    [fallbackImageUrl],
  ]) {
    const images = productImageUrls(source);
    if (images.length) return images;
  }
  return [];
}

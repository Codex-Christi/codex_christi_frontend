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

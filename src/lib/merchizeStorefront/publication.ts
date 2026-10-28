import { isMerchizeStorefrontProductAvailable } from '@/lib/paypal/orderSnapshot/merchizeAvailability';

export type StorefrontPublication = 'published' | 'unpublished' | 'unknown';

/** Display visibility only. Unknown/legacy fields never prove sellability or removal. */
export function getStorefrontPublication(value: unknown): StorefrontPublication {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'unknown';
  const product = value as Record<string, unknown>;
  const status = typeof product.status === 'string' ? product.status.trim().toLowerCase() : '';
  const approval =
    typeof product.approval_status === 'string' ? product.approval_status.trim().toLowerCase() : '';
  if (
    product._storefront_not_found === true ||
    product.is_active === false ||
    product.is_deleted === true ||
    product.is_private === true ||
    product.is_taken_down === true ||
    (status && status !== 'active') ||
    (approval && approval !== 'approved')
  )
    return 'unpublished';
  return isMerchizeStorefrontProductAvailable(product) ? 'published' : 'unknown';
}

export function isStorefrontProductUnpublished(value: unknown) {
  return getStorefrontPublication(value) === 'unpublished';
}

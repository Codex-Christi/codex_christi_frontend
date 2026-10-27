import type { ProductVariantsInterface } from '@/lib/merchizeStorefront/productTypes';

export type WishlistCartVariant = ProductVariantsInterface['data'][number];

function isOption(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const option = value as Record<string, unknown>;
  if (typeof option.value !== 'string' || typeof option.name !== 'string') return false;
  if (option.attribute == null) return true;
  if (typeof option.attribute !== 'object') return false;
  const attribute = option.attribute as Record<string, unknown>;
  return typeof attribute.name === 'string' && typeof attribute.value_type === 'string';
}

// Check the fields needed to create a complete cart line, including ownership of the option.
export function isCartVariant(value: unknown, productId: string): value is WishlistCartVariant {
  if (!value || typeof value !== 'object') return false;
  const variant = value as Partial<WishlistCartVariant>;
  return (
    typeof variant._id === 'string' &&
    variant._id.trim().length > 0 &&
    variant.product === productId &&
    typeof variant.title === 'string' &&
    typeof variant.is_default === 'boolean' &&
    typeof variant.sku === 'string' &&
    variant.sku.trim().length > 0 &&
    typeof variant.retail_price === 'number' &&
    Number.isFinite(variant.retail_price) &&
    variant.retail_price >= 0 &&
    Array.isArray(variant.options) &&
    variant.options.every(isOption) &&
    Array.isArray(variant.image_uris) &&
    variant.image_uris.every((image) => typeof image === 'string')
  );
}

export function variantLabel(variant: WishlistCartVariant) {
  return (
    variant.options
      .map((option) => {
        const value = option.name || option.value;
        return option.attribute?.name ? `${option.attribute.name}: ${value}` : value;
      })
      .join(' · ') ||
    variant.title ||
    'Standard option'
  );
}

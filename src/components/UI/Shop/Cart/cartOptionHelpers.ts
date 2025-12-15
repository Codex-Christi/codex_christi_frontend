import { ProductVariantOptions } from '@/app/shop/product/[id]/productDetailsSSR';
import type { VariantOption as CartStoreVariantOption } from '@/stores/shop_stores/cartStore';

export type CartOptionLike = ProductVariantOptions[number] | CartStoreVariantOption;

export const toCartOptions = (
  options?: ProductVariantOptions | CartStoreVariantOption[] | CartOptionLike[],
): CartOptionLike[] => {
  if (!Array.isArray(options)) return [];
  return options as CartOptionLike[];
};

export const getOptionLabel = (options: CartOptionLike[], name: string) => {
  if (!options.length) return null;
  const target = name.toLowerCase();
  const match = options.find((option) => option.attribute?.name?.toLowerCase() === target);
  if (!match) return null;

  if (name.toLowerCase() === 'color') {
    return (match as CartOptionLike).slug ?? match.value ?? null;
  }

  return match.value ?? (match as CartOptionLike).slug ?? null;
};

export const getColorAndSizeLabels = (options: CartOptionLike[]) => {
  const color = getOptionLabel(options, 'color');
  const size = getOptionLabel(options, 'size') ?? options[0]?.value ?? options[0]?.slug ?? null;

  return { color, size };
};

export const buildOptionSummary = (options: CartOptionLike[]) => {
  const { color, size } = getColorAndSizeLabels(options);
  const summary = [color ? `Color: ${color}` : null, size ? `Size: ${size}` : null]
    .filter(Boolean)
    .join(' • ');

  return {
    color,
    size,
    summary,
  };
};

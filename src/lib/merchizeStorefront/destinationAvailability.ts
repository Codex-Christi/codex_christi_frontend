import type { CatalogItem } from '@/lib/datasetSearchers/merchize/catalog';
import {
  calculateStrictShippingQuoteUsd,
  StrictShippingResolutionError,
} from '@/lib/paypal/orderSnapshot/strictShipping';

export type ProductUnavailabilityReason =
  'shipping_unavailable' | 'verification_unavailable' | 'product_unavailable' | null;

export function evaluateDestinationOptions(input: {
  options: Array<{ variantId: string; sku: string }>;
  catalogRows: CatalogItem[];
  countryIso3: string;
  unverifiedSkus?: string[];
  extrasBySku?: ReadonlyMap<string, Record<string, unknown> | undefined>;
}) {
  const bySku = new Map(input.catalogRows.map((row) => [row.SKU_variant, row]));
  const availableVariantIds: string[] = [];
  const unsupportedVariantIds: string[] = [];
  const unverifiedVariantIds: string[] = [];
  for (const option of input.options) {
    const row = bySku.get(option.sku);
    if (!row || !row.shippingBands || input.unverifiedSkus?.includes(option.sku)) {
      unverifiedVariantIds.push(option.variantId);
      continue;
    }
    try {
      calculateStrictShippingQuoteUsd({
        lines: [{ lineId: option.variantId, sku: option.sku, quantity: 1 }],
        catalogRows: [row],
        countryIso3: input.countryIso3,
        extrasBySku: input.extrasBySku,
      });
      availableVariantIds.push(option.variantId);
    } catch (error) {
      if (error instanceof StrictShippingResolutionError && error.code === 'INVALID_SHIPPING_BAND')
        unsupportedVariantIds.push(option.variantId);
      else unverifiedVariantIds.push(option.variantId);
    }
  }
  return { availableVariantIds, unsupportedVariantIds, unverifiedVariantIds };
}

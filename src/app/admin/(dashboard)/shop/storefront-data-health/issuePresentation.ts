const reasons: Record<string, string> = {
  CURRENT_PRESET_MATCH_NOT_FOUND: 'No exact supplier match for these options',
  CURRENT_PRESET_MATCH_AMBIGUOUS: 'More than one supplier option matches',
  CURRENT_CATALOG_SKU_NOT_FOUND: 'Supplier SKU was not found',
  CURRENT_PRESET_CATALOG_SKU_NOT_FOUND: 'Mapped supplier SKU was not found',
  CURRENT_PRESET_CATALOG_PRODUCT_ID_MISMATCH: 'Supplier product identity changed',
  CURRENT_PRESET_CATALOG_VARIANT_ID_MISMATCH: 'Supplier option identity changed',
  STOREFRONT_VARIANT_EXPLICITLY_UNAVAILABLE: 'Option is disabled at Merchize',
  STOREFRONT_PRODUCT_EXPLICITLY_UNAVAILABLE: 'Product is not published for sale at Merchize',
  CURRENT_CATALOG_GENERATION_UNAVAILABLE: 'Supplier data needs a new check',
  CURRENT_CATALOG_LOOKUP_UNAVAILABLE: 'Supplier data could not be checked',
  CURRENT_PRESET_PROVIDER_UNAVAILABLE: 'Merchize could not be reached',
};
export function describeStorefrontIssue(code: string) {
  return reasons[code] ?? 'Supplier verification needs review';
}

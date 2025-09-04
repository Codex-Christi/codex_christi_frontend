// Canonical destination keys and shapes used across the app
export type DestKey = 'US' | 'EU' | 'GB' | 'CA' | 'AU' | 'ROW';
export type ProductionRegion = 'US' | 'VN' | 'EU' | 'AU' | 'GB' | 'CA' | 'CN';

export type Band = {
  first_item?: number;
  additional_item?: number;
  import_tax_item?: number; // US sometimes
};

// Raw rows = tolerant to missing/extra fields from JSON
export type RawRow = {
  sku: string | null;
  sku_prefix_all_sheets?: string | null;
  product_name?: string | null;
  production_region: ProductionRegion | string;
  shipping?: Partial<Record<DestKey, Band | undefined>>;
  extras?: Record<string, unknown>;
};

// Strict Row after normalization
export type Row = {
  sku: string;
  sku_prefix_all_sheets?: string | null;
  product_name?: string | null;
  production_region: ProductionRegion;
  shipping: Partial<Record<DestKey, Band>>;
  extras?: Record<string, unknown>;
};

// Back-compat flat shape (now with AU fields)
export type CatalogItem = {
  SKU_product: string | null; // unknown -> null
  SKU_variant: string;

  // keep nullable for compatibility (remove if unused)
  tier_1_price?: number | null;
  tier_2_price?: number | null;
  tier_3_price?: number | null;

  US_shipping_fee: number | null;
  US_additional_shipping_fee: number | null;
  EU_shipping_fee: number | null;
  EU_additional_shipping_fee: number | null;
  GB_shipping_fee?: number | null;
  GB_additional_shipping_fee?: number | null;
  CA_shipping_fee?: number | null;
  CA_additional_shipping_fee?: number | null;
  AU_shipping_fee?: number | null;
  AU_additional_shipping_fee?: number | null;
  ROW_shipping_fee: number | null;
  ROW_additional_shipping_fee: number | null;
};

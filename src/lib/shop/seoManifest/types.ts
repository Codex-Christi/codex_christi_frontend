export const SHOP_SEO_MANIFEST_SCHEMA_VERSION = 1;
export const SHOP_SEO_MANIFEST_PROVIDER_MERCHIZE = 'merchize';

export type ShopSeoManifestSource = 'snapshot' | 'published_fallback' | 'category_fallback';
export type ShopSeoManifestProvider = typeof SHOP_SEO_MANIFEST_PROVIDER_MERCHIZE;

export type ProductSeoManifestEntry = {
  schemaVersion: typeof SHOP_SEO_MANIFEST_SCHEMA_VERSION;
  kind: 'product';
  provider: ShopSeoManifestProvider;
  id: string;
  route: string;
  title: string;
  description: string;
  image: string | null;
  price: string | null;
  currency: 'USD';
  source: ShopSeoManifestSource;
  updatedAt: string;
};

export type CategorySeoManifestEntry = {
  schemaVersion: typeof SHOP_SEO_MANIFEST_SCHEMA_VERSION;
  kind: 'category';
  provider: ShopSeoManifestProvider;
  slug: string;
  route: string;
  name: string;
  description: string;
  cover: string | null;
  totalPages: number | null;
  source: ShopSeoManifestSource;
  updatedAt: string;
};

export type ShopSeoManifestIndex = {
  schemaVersion: typeof SHOP_SEO_MANIFEST_SCHEMA_VERSION;
  activeGeneration: string;
  generatedAt: string;
  productCount: number;
  categoryCount: number;
  missingPublishedProductIds: string[];
  missingCategorySlugs: string[];
};

export type ShopSeoManifestStats = {
  activeGeneration: string | null;
  generatedAt: string | null;
  productCount: number;
  categoryCount: number;
  missingPublishedProductIds: string[];
  missingCategorySlugs: string[];
  manifestPath: string;
};

export type ShopSeoManifestGenerationResult = ShopSeoManifestStats & {
  ok: boolean;
  affectedRoutes: string[];
};

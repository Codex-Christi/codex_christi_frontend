import path from 'path';
import { SHOP_SEO_MANIFEST_PROVIDER_MERCHIZE } from './types';

const SHOP_SEO_MANIFEST_ROOT = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  'data',
  'shop',
  'seo-manifest',
  'v1',
);

export function getShopSeoManifestRoot() {
  return SHOP_SEO_MANIFEST_ROOT;
}

export function getShopSeoManifestIndexPath() {
  return path.join(SHOP_SEO_MANIFEST_ROOT, 'manifest-index.json');
}

export function getShopSeoManifestGenerationPath(generation: string) {
  return path.join(SHOP_SEO_MANIFEST_ROOT, 'generations', generation);
}

export function getProductSeoManifestPath(generation: string, productId: string) {
  return path.join(
    getShopSeoManifestGenerationPath(generation),
    'providers',
    SHOP_SEO_MANIFEST_PROVIDER_MERCHIZE,
    'products',
    'by-id',
    `merchize-product-${toManifestFileName(productId)}.seo.json`,
  );
}

export function getCategorySeoManifestPath(generation: string, categorySlug: string) {
  return path.join(
    getShopSeoManifestGenerationPath(generation),
    'providers',
    SHOP_SEO_MANIFEST_PROVIDER_MERCHIZE,
    'categories',
    'by-slug',
    `merchize-category-${toManifestFileName(categorySlug)}.seo.json`,
  );
}

export function toManifestFileName(value: string) {
  return encodeURIComponent(value.trim().toLowerCase());
}

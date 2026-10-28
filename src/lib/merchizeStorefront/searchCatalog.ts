import 'server-only';
import { cache } from 'react';
import { merchizeCatalogPrisma as db } from '@/lib/prisma/shop/merchize/merchizeCatalogPrisma';
import { getStorefrontPublication } from './publication';
import { resolveProductGalleryImages } from './imageUrls';
import { fetchMerchizeJson, MerchizeProviderError } from './providerErrors';
import {
  canUseSavedListing,
  parseStorefrontListing,
  STOREFRONT_LISTING_TIMEOUT_MS,
} from './listingPayload';
import {
  createProductSearch,
  normalizeSearchQuery,
  SEARCH_PAGE_SIZE,
  type SearchProduct,
} from './productSearch';
import { upsertStorefrontProductSnapshot } from './snapshot';
import { getUnpublishedStorefrontProductIds } from './publicationSnapshot';

const MAX_INDEX_PRODUCTS = 1000;

function publishedProduct(raw: unknown): raw is Record<string, unknown> {
  return getStorefrontPublication(raw) === 'published';
}

export const getProductSearchIndex = cache(async () => {
  const rows = await db.storefrontProductSnapshot.findMany({
    orderBy: [{ title: 'asc' }, { merchizeProductId: 'asc' }],
    take: MAX_INDEX_PRODUCTS + 1,
    select: {
      merchizeProductId: true,
      title: true,
      image: true,
      retailPrice: true,
      rawProductJson: true,
      lastProductFetchAt: true,
    },
  });
  if (!rows.length) throw new Error('The storefront search index is not ready.');
  const removed = await db.storefrontProductCheck.findMany({
    where: {
      merchizeProductId: { in: rows.map((row) => row.merchizeProductId) },
      completed: true,
      productAvailable: false,
    },
    select: { merchizeProductId: true, checkedAt: true },
  });
  const removedAt = new Map(removed.map((row) => [row.merchizeProductId, row.checkedAt.getTime()]));
  return {
    products: rows.slice(0, MAX_INDEX_PRODUCTS).flatMap((row): SearchProduct[] => {
      if (
        !row.title ||
        !publishedProduct(row.rawProductJson) ||
        (removedAt.get(row.merchizeProductId) ?? -1) >= (row.lastProductFetchAt?.getTime() ?? 0)
      )
        return [];
      return [
        {
          id: row.merchizeProductId,
          title: row.title.slice(0, 300),
          image:
            resolveProductGalleryImages({
              metadata: row.rawProductJson,
              fallbackImageUrl: row.image,
            })[0] ?? null,
          price: row.retailPrice,
        },
      ];
    }),
    truncated: rows.length > MAX_INDEX_PRODUCTS,
  };
});

export type ProductSearchResults = {
  products: SearchProduct[];
  page: number;
  totalPages: number;
  source: 'supplier' | 'saved' | 'similar' | 'unavailable';
};

export const searchStorefrontProducts = cache(
  async (input: string, page = 1): Promise<ProductSearchResults> => {
    const query = normalizeSearchQuery(input);
    if (!query || !Number.isSafeInteger(page) || page < 1 || page > 1000)
      throw new RangeError('Invalid product search.');
    let source: ProductSearchResults['source'] = 'supplier';
    try {
      const baseUrl = process.env.MERCHIZE_BASE_URL;
      const apiKey = process.env.MERCHIZE_API_KEY;
      if (!baseUrl || !apiKey)
        throw new MerchizeProviderError({
          url: '',
          status: null,
          message: 'Storefront search credentials unavailable.',
        });
      const params = new URLSearchParams({
        title: query,
        page: String(page),
        limit: String(SEARCH_PAGE_SIZE),
      });
      const response = await fetchMerchizeJson(
        `${baseUrl}/product/products?${params}`,
        {
          headers: { 'X-API-KEY': apiKey },
          next: { revalidate: 300 },
        },
        { timeoutMs: STOREFRONT_LISTING_TIMEOUT_MS },
      );
      const data = parseStorefrontListing(response, page, SEARCH_PAGE_SIZE);
      const published = data.products.filter(publishedProduct);
      // Reuse the existing display snapshot, never the checkout availability evidence.
      try {
        for (const product of data.products) await upsertStorefrontProductSnapshot(product);
      } catch {
        console.warn(
          '[shop.search] display snapshots could not be updated; returning supplier results',
        );
      }
      const unpublishedIds = await getUnpublishedStorefrontProductIds(
        published.map((product) => product._id),
      ).catch(() => new Set<string>());
      if (data.total > 0 || page > 1)
        return {
          products: published
            .filter((product) => !unpublishedIds.has(product._id))
            .map((product) => ({
              id: product._id,
              title: product.title,
              image: resolveProductGalleryImages({ metadata: product })[0] ?? null,
              price: Number(product.retail_price),
            })),
          page,
          totalPages: data.pages,
          source,
        };
      source = 'similar';
    } catch (error) {
      if (!canUseSavedListing(error)) {
        console.warn('[shop.search] supplier search failed', {
          name: error instanceof Error ? error.name : 'unknown',
        });
        return { products: [], page, totalPages: 0, source: 'unavailable' };
      }
      source = 'saved';
    }
    try {
      const index = await getProductSearchIndex();
      const matches = createProductSearch(index.products)(query, MAX_INDEX_PRODUCTS);
      return {
        products: matches.slice((page - 1) * SEARCH_PAGE_SIZE, page * SEARCH_PAGE_SIZE),
        page,
        totalPages: Math.ceil(matches.length / SEARCH_PAGE_SIZE),
        source,
      };
    } catch {
      return {
        products: [],
        page,
        totalPages: 0,
        source: source === 'similar' ? source : 'unavailable',
      };
    }
  },
);

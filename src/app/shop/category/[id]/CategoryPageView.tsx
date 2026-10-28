import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchCategoryProducts, getCategoryMetadataFromMerchize } from './categoryDetailsSSR';
import { getShopSiteUrl } from '@/lib/siteBaseUrls';
import {
  getCategoryMetadataFromSnapshot,
  normalizeStorefrontCategorySlug,
} from '@/lib/merchizeStorefront/snapshot';
import { STOREFRONT_SNAPSHOT_CATEGORY_SLUGS } from '@/lib/merchizeStorefront/categories';
import { readCategorySeoManifestEntry } from '@/lib/shop/seoManifest/read';
import type { CategorySeoManifestEntry } from '@/lib/shop/seoManifest/types';
import { recordShopMetadataSource } from '@/lib/shop/seoManifest/metadataObservability';
import { coerceMerchizeProviderError } from '@/lib/merchizeStorefront/providerErrors';
import CustomShopLink from '@/components/UI/Shop/HelperComponents/CustomShopLink';
import type { CategoryProductCardData } from '@/components/UI/Shop/Categories/[eachCategory]/CategoryListProductCard/ProductCard';
import ProductList from '@/components/UI/Shop/Categories/[eachCategory]/CategoryListProductCard/ProductList';
import PaginationControls from '@/components/UI/Shop/Categories/[eachCategory]/CategoryListProductCard/PaginationControls';
import { isStorefrontProductUnpublished } from '@/lib/merchizeStorefront/publication';
import { getUnpublishedStorefrontProductIds } from '@/lib/merchizeStorefront/publicationSnapshot';

export const CATEGORY_PAGE_SIZE = 15;
const SHOP_SITE_NAME = 'Codex Christi Shop';

function displayCategoryName(categorySlug: string) {
  return normalizeStorefrontCategorySlug(categorySlug)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function fallbackCategoryMetadata(categoryName: string) {
  const name = displayCategoryName(categoryName) || 'Shop';

  return {
    cover: null,
    description: `Shop ${name} from Codex Christi.`,
    name,
  };
}

function isPublishedCategory(categoryName: string) {
  const categorySlug = normalizeStorefrontCategorySlug(categoryName);
  return STOREFRONT_SNAPSHOT_CATEGORY_SLUGS.some((slug) => slug === categorySlug);
}

function toCategoryMetadata({
  categoryName,
  page,
  name,
  description,
  coverUrl,
  shouldIndex,
}: {
  categoryName: string;
  page: number;
  name: string;
  description: string;
  coverUrl: string | null | undefined;
  shouldIndex: boolean;
}): Metadata {
  const title =
    page > 1 ? `${name} - Page ${page} | ${SHOP_SITE_NAME}` : `${name} | ${SHOP_SITE_NAME}`;
  const urlSuffix = page > 1 ? `/page/${page}` : '';

  return {
    title,
    description,
    ...(shouldIndex ? {} : { robots: { index: false, follow: false } }),
    openGraph: {
      title,
      description,
      ...(coverUrl ? { images: [{ url: coverUrl }] } : {}),
      type: 'website',
      url: getShopSiteUrl(`/category/${categoryName}${urlSuffix}`),
      locale: 'en_US',
      siteName: SHOP_SITE_NAME,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(coverUrl ? { images: coverUrl } : {}),
    },
  };
}

function toCategoryMetadataFromManifest(
  entry: CategorySeoManifestEntry,
  categoryName: string,
  page: number,
): Metadata {
  return toCategoryMetadata({
    categoryName,
    page,
    name: entry.name,
    description: entry.description,
    coverUrl: entry.cover,
    shouldIndex: true,
  });
}

async function getDevLiveCategoryMetadata(categoryName: string) {
  if (process.env.NODE_ENV === 'production') return null;

  try {
    return await getCategoryMetadataFromMerchize(categoryName);
  } catch (error) {
    if (coerceMerchizeProviderError(error)?.kind === 'not_found') return null;
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[category.generateMetadata] dev live metadata fetch failed:', message);
    return null;
  }
}

export async function generateCategoryPageMetadata(
  categoryName: string,
  page = 1,
): Promise<Metadata> {
  const startedAt = Date.now();
  const categorySlug = normalizeStorefrontCategorySlug(categoryName);

  const manifestEntry = await readCategorySeoManifestEntry(categoryName).catch((err) => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn('[category.generateMetadata] manifest metadata lookup failed:', errorMessage);
    return null;
  });
  if (manifestEntry) {
    recordShopMetadataSource({
      targetKind: 'category',
      targetId: categorySlug,
      source: 'manifest',
      startedAt,
      shouldIndex: true,
      page,
    });
    return toCategoryMetadataFromManifest(manifestEntry, categoryName, page);
  }

  const categoryMetaData = await getCategoryMetadataFromSnapshot(categoryName).catch((err) => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn('[category.generateMetadata] snapshot metadata lookup failed:', errorMessage);
    return null;
  });

  if (categoryMetaData) {
    recordShopMetadataSource({
      targetKind: 'category',
      targetId: categorySlug,
      source: 'snapshot',
      startedAt,
      shouldIndex: true,
      page,
    });
    return toCategoryMetadata({
      categoryName,
      page,
      name: categoryMetaData.name,
      description: categoryMetaData.description,
      coverUrl: categoryMetaData.cover?.url,
      shouldIndex: true,
    });
  }

  const devLiveCategoryMetaData = await getDevLiveCategoryMetadata(categoryName);
  if (devLiveCategoryMetaData) {
    recordShopMetadataSource({
      targetKind: 'category',
      targetId: categorySlug,
      source: 'dev_live',
      startedAt,
      shouldIndex: true,
      page,
    });
    return toCategoryMetadata({
      categoryName,
      page,
      name: devLiveCategoryMetaData.name,
      description: devLiveCategoryMetaData.description,
      coverUrl: devLiveCategoryMetaData.cover?.url,
      shouldIndex: true,
    });
  }

  const fallback = fallbackCategoryMetadata(categoryName);
  const shouldIndex = isPublishedCategory(categoryName);
  recordShopMetadataSource({
    targetKind: 'category',
    targetId: categorySlug,
    source: shouldIndex ? 'category_fallback' : 'unknown_noindex',
    startedAt,
    shouldIndex,
    page,
  });
  return toCategoryMetadata({
    categoryName,
    page,
    name: fallback.name,
    description: fallback.description,
    coverUrl: null,
    shouldIndex,
  });
}

async function getCategoryPageData(categoryName: string, page: number, productLimit: number) {
  try {
    const [categoryMetaData, initialProductFetchResp] = await Promise.all([
      getCategoryMetadataFromMerchize(categoryName),
      fetchCategoryProducts({ category: categoryName, page, page_size: productLimit }),
    ]);

    return {
      categoryMetaData,
      initialProductFetchResp,
    };
  } catch (err) {
    if (coerceMerchizeProviderError(err)?.kind === 'not_found') return null;
    throw err;
  }
}

export default async function CategoryPageView({
  categoryName,
  page,
}: {
  categoryName: string;
  page: number;
}) {
  const productLimit = CATEGORY_PAGE_SIZE;
  const pageData = await getCategoryPageData(categoryName, page, productLimit);
  if (!pageData) {
    notFound();
  }

  const { name, description } = pageData.categoryMetaData;
  const { products, totalPages } = pageData.initialProductFetchResp;
  if (page > 1 && page > totalPages) notFound();
  const unpublishedIds = await getUnpublishedStorefrontProductIds(
    products.map((product) => product._id),
  ).catch(() => new Set<string>());

  // Keep listing cards limited to the display fields they need.
  const cardProducts: CategoryProductCardData[] = products
    .filter(
      (product) => !isStorefrontProductUnpublished(product) && !unpublishedIds.has(product._id),
    )
    .map(({ _id, title, slug, image, retail_price }) => ({
      _id,
      title,
      slug,
      image,
      retail_price,
    }));

  return (
    <div className='min-h-[60vh]'>
      <header className='px-8 pt-10'>
        <h1 className='font-ocr text-3xl'>{name}</h1>
        <h2 className='text-lg'>{description}</h2>
      </header>

      <main className='px-8 pt-7 flex flex-col gap-16 mb-10'>
        {cardProducts.length > 0 ? (
          <ProductList initialData={cardProducts} />
        ) : (
          <div className='space-y-4 py-12 text-center'>
            <p>No products available on this page.</p>
            <CustomShopLink href='/shop/categories' className='underline underline-offset-4'>
              Browse other categories
            </CustomShopLink>
          </div>
        )}
        {(cardProducts.length > 0 || totalPages > 1) && (
          <PaginationControls currentPage={page} category={categoryName} totalPages={totalPages} />
        )}
      </main>
    </div>
  );
}

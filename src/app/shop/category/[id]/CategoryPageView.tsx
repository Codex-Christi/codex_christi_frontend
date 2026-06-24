import { Metadata } from 'next';
import dynamic from 'next/dynamic';
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

const ProductList = dynamic(
  () =>
    import('@/components/UI/Shop/Categories/[eachCategory]/CategoryListProductCard/ProductList'),
);
const PaginationControls = dynamic(
  () =>
    import('@/components/UI/Shop/Categories/[eachCategory]/CategoryListProductCard/PaginationControls'),
);

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
    console.log(err);
    return null;
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
    return notFound();
  }

  const { name, description } = pageData.categoryMetaData;
  const { products, totalPages } = pageData.initialProductFetchResp;

  return (
    <div className='min-h-[60vh]'>
      <header className='px-8 pt-10'>
        <h1 className='font-ocr text-3xl'>{name}</h1>
        <h2 className='text-lg'>{description}</h2>
      </header>

      <main className='px-8 pt-7 flex flex-col gap-16 mb-10'>
        <ProductList count={productLimit} initialData={products} />

        <PaginationControls currentPage={page} category={categoryName} totalPages={totalPages} />
      </main>
    </div>
  );
}

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

export async function generateCategoryPageMetadata(
  categoryName: string,
  page = 1,
): Promise<Metadata> {
  // Keep route metadata off Merchize; publishable SEO data must be warmed into snapshots.
  const categoryMetaData = await getCategoryMetadataFromSnapshot(categoryName).catch((err) => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn('[category.generateMetadata] snapshot metadata lookup failed:', errorMessage);
    return null;
  });

  const { cover, description, name } = categoryMetaData ?? fallbackCategoryMetadata(categoryName);
  const shouldIndex = Boolean(categoryMetaData) || isPublishedCategory(categoryName);
  const title =
    page > 1 ? `${name} - Page ${page} | ${SHOP_SITE_NAME}` : `${name} | ${SHOP_SITE_NAME}`;
  const urlSuffix = page > 1 ? `/page/${page}` : '';

  try {
    return {
      title,
      description,
      ...(shouldIndex ? {} : { robots: { index: false, follow: false } }),
      openGraph: {
        title,
        description,
        ...(cover ? { images: [{ url: cover.url }] } : {}),
        type: 'website',
        url: getShopSiteUrl(`/category/${categoryName}${urlSuffix}`),
        locale: 'en_US',
        siteName: SHOP_SITE_NAME,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        ...(cover ? { images: cover.url } : {}),
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn('[category.generateMetadata] metadata build failed:', errorMessage);
    return {
      title,
      description,
    };
  }
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

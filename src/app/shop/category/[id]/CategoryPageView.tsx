import { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import { fetchCategoryProducts, getCategoryMetadataFromMerchize } from './categoryDetailsSSR';
import { getShopSiteUrl } from '@/lib/siteBaseUrls';

const ProductList = dynamic(
  () =>
    import('@/components/UI/Shop/Categories/[eachCategory]/CategoryListProductCard/ProductList'),
);
const PaginationControls = dynamic(
  () =>
    import('@/components/UI/Shop/Categories/[eachCategory]/CategoryListProductCard/PaginationControls'),
);

export const CATEGORY_PAGE_SIZE = 15;

export async function generateCategoryPageMetadata(
  categoryName: string,
  page = 1,
): Promise<Metadata> {
  try {
    const categoryMetaData = await getCategoryMetadataFromMerchize(categoryName);

    const { cover, description, name } = categoryMetaData;
    const title =
      page > 1 ? `${name} - Page ${page} | Codex Christi Shop` : `${name} | Codex Christi Shop`;
    const urlSuffix = page > 1 ? `/page/${page}` : '';

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        ...(cover ? { images: [{ url: cover.url }] } : {}),
        type: 'website',
        url: getShopSiteUrl(`/category/${categoryName}${urlSuffix}`),
        locale: 'en_US',
        siteName: 'Codex Christi Shop',
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
    console.warn('[category.generateMetadata] metadata fetch failed:', errorMessage);
    return {
      title: 'Product not found',
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

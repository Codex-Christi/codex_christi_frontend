import { Metadata } from 'next';
import { fetchCategoryProducts, getCategoryMetadataFromMerchize } from './categoryDetailsSSR';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { Suspense } from 'react';
import Skeleton from './Skeleton';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

// ✅ 1. Generate metadata dynamically
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { id: categoryName } = await params;
    const categoryMetaData = await getCategoryMetadataFromMerchize(categoryName);

    const { cover, description, name } = categoryMetaData;

    const title = `${name} | Codex Christi Shop`;

    return {
      title: title,
      description: description,
      openGraph: {
        title: title,
        description: description,
        // ✅ Correct conditional: Omit images property entirely when no cover
        ...(cover ? { images: [{ url: cover.url }] } : {}),
        type: 'website',
        url: `https://codexchristi.shop/category/${categoryName}`,
        locale: 'en_US',
        siteName: 'Codex Christi Shop',
      },
      twitter: {
        card: 'summary_large_image',
        title: title,
        description: description,
        // ✅ Correct conditional: Omit images property entirely when no cover
        ...(cover ? { images: cover.url } : {}),
      },
    };
  } catch {
    // fallback metadata or suppress entirely
    return {
      title: 'Product not found',
    };
  }
}

export default async function EachCategoryPage({ params, searchParams }: PageProps) {
  const { id: categoryName } = await params;
  const searchParamsObj = await searchParams;
  const page = parseInt((searchParamsObj?.page as string) ?? '1');

  // Device Type SSR
  const userAgent = (await headers()).get('user-agent') || '';
  const deviceType = /mobile|android|iphone|ipad|ipod/i.test(userAgent) ? 'mobile' : 'desktop';
  const productLimit = deviceType === 'mobile' ? 10 : 20;

  try {
    const [categoryMetaData, initialProductFetchResp] = await Promise.all([
      getCategoryMetadataFromMerchize(categoryName),
      fetchCategoryProducts({ category: categoryName, page, page_size: productLimit }),
    ]);

    const { name, description } = categoryMetaData;
    const { next, products } = initialProductFetchResp;

    return (
      <div className='min-h-[60vh]'>
        <header className='px-8 pt-10'>
          <h1 className='font-ocr text-3xl'>{name}</h1>
          <h2 className='text-lg'>{description}</h2>
        </header>

        <Skeleton count={productLimit} />

        {/* <Suspense fallback={<Skeleton count={productLimit} />}>
          <main className='px-8'>
            <h4>Products Loaded: {JSON.stringify(initialProductFetchResp)}</h4>
          </main>
        </Suspense> */}
      </div>
    );
  } catch (err) {
    console.log(err);

    return notFound();
  }
}

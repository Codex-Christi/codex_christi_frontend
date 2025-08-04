import { Metadata } from 'next';
import { getCategoryMetadataFromMerchize } from './categoryDetailsSSR';
import { notFound } from 'next/navigation';

type PageProps = {
  params: Promise<{ id: string }>;
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

export default async function EachCategoryPage({ params }: PageProps) {
  try {
    const { id: categoryName } = await params;

    const categoryMetaData = await getCategoryMetadataFromMerchize(categoryName);

    const { name, description } = categoryMetaData;
    return (
      <div className='min-h-[60vh]'>
        <header className='px-8 py-10'>
          <h1 className='font-ocr text-3xl'>{name}</h1>
          <h2 className='text-lg'>{description}</h2>
        </header>
      </div>
    );
  } catch (err) {
    console.log(err);

    return notFound();
  }
}

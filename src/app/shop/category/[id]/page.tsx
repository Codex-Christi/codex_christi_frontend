import { Metadata } from 'next';
import { getCategoryMetadataFromMerchize } from './categoryDetailsSSR';
import { notFound } from 'next/navigation';
import Image from 'next/image';

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
        images: cover ? [{ url: cover.url }] : undefined,
        type: 'website',
        url: `https://codexchristi.shop/category/${categoryName}`,
        locale: 'en_US',
        siteName: 'Codex Christi Shop',
      },
      twitter: {
        card: 'summary_large_image',
        title: title,
        description: description,
        images: cover ? cover?.url : undefined,
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

    const { cover, name, description } = categoryMetaData;
    return (
      <header>
        <h1>{name}</h1>
        <h2>{description}</h2>
        {cover && <Image src={cover.url} alt={`${name} category cover image`} />}
      </header>
    );
  } catch {
    return notFound();
  }
}

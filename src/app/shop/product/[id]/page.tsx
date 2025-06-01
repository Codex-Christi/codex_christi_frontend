// import Image from 'next/image';
// import Calendar from '@/assets/img/calendar.png';
import ProductDetailsClientComponent from '@/components/UI/Shop/ProductDetails';
import { Metadata } from 'next';
import {
  getProductDetailsSSR,
  getProductMetaDataOnly,
} from './productDetailsSSR';
import { notFound } from 'next/navigation';
// import { useProductDetailsStore } from './detailsStore';

type PageProps = {
  params: Promise<{ id: string }>;
};

// Once we started consuming the API this would be replaced wuth `generateMetadata`
// ✅ 1. Generate metadata dynamically
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  try {
    const { id } = await params;
    const productMetaData = await getProductMetaDataOnly(id);

    const title = `${productMetaData.title} | Codex Christi Shop`;
    const description = productMetaData.description
      .split('.')[0]
      .replace(/<[^>]*>/g, '');

    return {
      title: title,
      description: `Buy ${productMetaData.title} now. Limited edition.`,
      openGraph: {
        title: title,
        description: description,
        images: [{ url: productMetaData.image }],
        type: 'website',
        url: `https://codexchristi.shop/product/${id}`,
        locale: 'en_US',
        siteName: 'Codex Christi Shop',
      },
      twitter: {
        card: 'summary_large_image',
        title: title,
        description: description,
        images: productMetaData.image,
      },
    };
  } catch {
    // fallback metadata or suppress entirely
    return {
      title: 'Product not found',
    };
  }
}

// ✅ 2. Main component for the product details page
const ProductDetails = async ({ params }: PageProps) => {
  const { id: productID } = await params;

  //   Main SSR generator
  const productData = await getProductDetailsSSR(productID)
    .then((data) => data)
    .catch((error) => {
      console.error('Error fetching product details:', error);
      return notFound(); // or handle the error as needed
    });

  // Main JSX
  return <ProductDetailsClientComponent fetchedProductData={productData} />;
};

export default ProductDetails;

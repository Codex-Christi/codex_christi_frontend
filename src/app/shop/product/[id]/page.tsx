// import Image from 'next/image';
// import Calendar from '@/assets/img/calendar.png';
import ProductDetailsClientComponent from '@/components/UI/Shop/ProductDetails';
import { Metadata } from 'next';
import { getProductDetailsSSR } from './productDetailsSSR';
import { notFound } from 'next/navigation';
import serialize from 'serialize-javascript';

type PageProps = {
  params: Promise<{ id: string }>;
};

// Once we started consuming the API this would be replaced wuth `generateMetadata`
// ✅ 1. Generate metadata dynamically
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { id } = await params;
    const { productMetaData, productVariants } = await getProductDetailsSSR(id);
    const firstImage = productVariants[0].image_uris[0];
    const firstImageUrl = `https://d2dytk4tvgwhb4.cloudfront.net/${firstImage}`;

    const title = `${productMetaData.title} | Codex Christi Shop`;
    const description = productMetaData.description.split('.')[0].replace(/<[^>]*>/g, '');

    return {
      title: title,
      description: `Buy ${productMetaData.title} now. Limited edition.`,
      openGraph: {
        title: title,
        description: description,
        images: [{ url: firstImageUrl }],
        url: `https://codexchristi.shop/product/${id}`,
        locale: 'en_US',
        siteName: 'Codex Christi Shop',
      },
      twitter: {
        card: 'summary_large_image',
        title: title,
        description: description,
        images: firstImageUrl,
      },
      other: {
        'og:type': 'product', // Manually add the custom og:type
        'og:product:price:amount': productMetaData.retail_price.toString(),
        'og:product:price:currency': 'USD',
        // Add other product-specific tags as needed
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

  const {
    productMetaData: { description, title, retail_price },
    productVariants,
  } = productData;
  const LDImageURL = `https://d2dytk4tvgwhb4.cloudfront.net/${productVariants[0].image_uris[0]}`;
  const trimmedDescription = description
    ? description.split('.')[0].replace(/<[^>]*>/g, '')
    : `Buy the limited ${title} `;

  const JSON_LD_Data = serialize({
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: title,
    image: LDImageURL,
    description: trimmedDescription,
    brand: {
      '@type': 'Brand',
      name: 'Codex Christi',
    },
    offers: {
      '@type': 'Offer',
      price: retail_price,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      // Optional but nice-to-have:
      // priceValidUntil: '2026-12-31',
    },
  });

  // Main JSX
  return (
    <>
      <ProductDetailsClientComponent fetchedProductData={productData} />;
      <script type='application/ld+json'>{JSON_LD_Data}</script>
    </>
  );
};

export default ProductDetails;

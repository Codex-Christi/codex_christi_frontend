import ProductDetailsShell from '@/components/UI/Shop/ProductDetails/ProductDetailsShell';
import { Metadata } from 'next';
import { getProductMetaDataOnly } from './productDetailsSSR';
import { notFound } from 'next/navigation';
import serialize from 'serialize-javascript';
import { extractProductMetaDescriptionFromHtml } from '@/lib/utils/extract-plain-text-from-html';
import { getBasicProductFromSnapshot } from '@/lib/merchizeStorefront/snapshot';
import {
  ProductDescriptionSection,
  ProductFeedbackSection,
} from '@/components/UI/Shop/ProductDetails/ProductStaticSections';
import { getShopSiteUrl } from '@/lib/siteBaseUrls';
import { getPublishedShopProductPreview } from '@/lib/utils/shopHomePageProductsData';

type PageProps = {
  params: Promise<{ id: string }>;
};

export const revalidate = 3600;
export const dynamicParams = true;
const SHOP_SITE_NAME = 'Codex Christi Shop';

export async function generateStaticParams() {
  return [];
}

function resolveProductImageUrl(image: string | undefined | null) {
  if (!image) return undefined;
  if (image.startsWith('/')) return getShopSiteUrl(image);
  const imageUrl = image.startsWith('http') ? image : `https://d2dytk4tvgwhb4.cloudfront.net/${image}`;
  return imageUrl.replace(/\/thumb\.jpg(?:[?#].*)?$/i, '');
}

function getSnapshotMissProductMetadata(productId: string): Metadata {
  const publishedProduct = getPublishedShopProductPreview(productId);

  if (publishedProduct) {
    const title = `${publishedProduct.title} | ${SHOP_SITE_NAME}`;
    const description = `Shop ${publishedProduct.title} from Codex Christi.`;
    const imageUrl = resolveProductImageUrl(publishedProduct.imagePath);

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
        url: getShopSiteUrl(`/product/${productId}`),
        locale: 'en_US',
        siteName: SHOP_SITE_NAME,
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        ...(imageUrl ? { images: imageUrl } : {}),
      },
      other: {
        'og:type': 'product',
        'og:product:price:amount': publishedProduct.retailPrice,
        'og:product:price:currency': 'USD',
      },
    };
  }

  return {
    title: `Product metadata unavailable | ${SHOP_SITE_NAME}`,
    description: 'This product page is not ready for search indexing.',
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      title: `Product metadata unavailable | ${SHOP_SITE_NAME}`,
      description: 'This product page is not ready for search indexing.',
      url: getShopSiteUrl(`/product/${productId}`),
      locale: 'en_US',
      siteName: SHOP_SITE_NAME,
    },
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    // Keep route metadata off Merchize; publishable SEO data must be warmed into snapshots.
    const productMetaData = await getBasicProductFromSnapshot(id);
    if (!productMetaData) return getSnapshotMissProductMetadata(id);

    const firstImageUrl = resolveProductImageUrl(productMetaData.image);

    const title = `${productMetaData.title} | ${SHOP_SITE_NAME}`;
    const description = extractProductMetaDescriptionFromHtml(
      productMetaData.description,
      productMetaData.title,
    );

    return {
      title: title,
      description: description,
      openGraph: {
        title: title,
        description: description,
        ...(firstImageUrl ? { images: [{ url: firstImageUrl }] } : {}),
        url: getShopSiteUrl(`/product/${id}`),
        locale: 'en_US',
        siteName: SHOP_SITE_NAME,
      },
      twitter: {
        card: 'summary_large_image',
        title: title,
        description: description,
        ...(firstImageUrl ? { images: firstImageUrl } : {}),
      },
      other: {
        'og:type': 'product', // Manually add the custom og:type
        'og:product:price:amount': productMetaData.retail_price.toString(),
        'og:product:price:currency': 'USD',
        // Add other product-specific tags as needed
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn('[product.generateMetadata] snapshot metadata lookup failed:', errorMessage);
    return getSnapshotMissProductMetadata(id);
  }
}

// ✅ 2. Main component for the product details page
const ProductDetails = async ({ params }: PageProps) => {
  const { id: productID } = await params;

  const productMetaData = await getProductMetaDataOnly(productID)
    .then((data) => data)
    .catch((error) => {
      console.error('Error fetching product details:', error);
      return notFound(); // or handle the error as needed
    });

  const { description, title, retail_price } = productMetaData;

  const productData = {
    productMetaData,
    productVariants: [],
  };
  const firstImageUrl = resolveProductImageUrl(productMetaData.image);
  const initialImageUrls = firstImageUrl ? [firstImageUrl] : [];
  const clientProductMetaData = {
    ...productMetaData,
    description: '',
  };
  const trimmedDescription = extractProductMetaDescriptionFromHtml(description, title);

  const JSON_LD_Data = serialize({
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: title,
    ...(firstImageUrl ? { image: firstImageUrl } : {}),
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
      <ProductDetailsShell
        productId={productID}
        fetchedProductData={{ ...productData, productMetaData: clientProductMetaData }}
        initialImageUrls={initialImageUrls}
        descriptionSection={<ProductDescriptionSection description={description} />}
      />
      <ProductFeedbackSection />
      <script type='application/ld+json'>{JSON_LD_Data}</script>
    </>
  );
};

export default ProductDetails;

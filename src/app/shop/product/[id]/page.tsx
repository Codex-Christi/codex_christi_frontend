import ProductDetailsShell from '@/components/UI/Shop/ProductDetails/ProductDetailsShell';
import { Metadata } from 'next';
import { getProductMetaDataOnly, merchizeAPIKey, merchizeBaseURL } from './productDetailsSSR';
import { notFound } from 'next/navigation';
import serialize from 'serialize-javascript';
import { extractProductMetaDescriptionFromHtml } from '@/lib/utils/extract-plain-text-from-html';
import { getBasicProductFromSnapshot } from '@/lib/merchizeStorefront/snapshot';
import { fetchMerchizeJson } from '@/lib/merchizeStorefront/providerErrors';
import type { BasicProductInterface } from '@/lib/merchizeStorefront/productTypes';
import {
  ProductDescriptionSection,
  ProductFeedbackSection,
} from '@/components/UI/Shop/ProductDetails/ProductStaticSections';
import { getShopSiteUrl } from '@/lib/siteBaseUrls';
import { getPublishedShopProductPreview } from '@/lib/utils/shopHomePageProductsData';
import { readProductSeoManifestEntry } from '@/lib/shop/seoManifest/read';
import type { ProductSeoManifestEntry } from '@/lib/shop/seoManifest/types';
import { recordShopMetadataSource } from '@/lib/shop/seoManifest/metadataObservability';

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

function toProductMetadata({
  productId,
  title,
  description,
  image,
  price,
}: {
  productId: string;
  title: string;
  description: string;
  image: string | null | undefined;
  price: string | number | null | undefined;
}): Metadata {
  const imageUrl = resolveProductImageUrl(image);
  const priceAmount = price === null || price === undefined ? null : price.toString();

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
      ...(priceAmount ? { 'og:product:price:amount': priceAmount } : {}),
      'og:product:price:currency': 'USD',
    },
  };
}

function toProductMetadataFromManifest(entry: ProductSeoManifestEntry): Metadata {
  return toProductMetadata({
    productId: entry.id,
    title: `${entry.title} | ${SHOP_SITE_NAME}`,
    description: entry.description,
    image: entry.image,
    price: entry.price,
  });
}

async function getDevLiveProductMetadata(productId: string) {
  if (process.env.NODE_ENV === 'production') return null;

  try {
    const json = await fetchMerchizeJson<BasicProductInterface>(
      `${merchizeBaseURL}/product/products/${productId}`,
      {
        headers: {
          'X-API-KEY': `${merchizeAPIKey}`,
        },
      },
    );
    return json.data;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[product.generateMetadata] dev live metadata fetch failed:', message);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const startedAt = Date.now();
  const { id } = await params;

  const manifestEntry = await readProductSeoManifestEntry(id).catch((err) => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn('[product.generateMetadata] manifest metadata lookup failed:', errorMessage);
    return null;
  });
  if (manifestEntry) {
    recordShopMetadataSource({
      targetKind: 'product',
      targetId: id,
      source: 'manifest',
      startedAt,
      shouldIndex: true,
    });
    return toProductMetadataFromManifest(manifestEntry);
  }

  const productMetaData = await getBasicProductFromSnapshot(id).catch((err) => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.warn('[product.generateMetadata] snapshot metadata lookup failed:', errorMessage);
    return null;
  });

  if (productMetaData) {
    recordShopMetadataSource({
      targetKind: 'product',
      targetId: id,
      source: 'snapshot',
      startedAt,
      shouldIndex: true,
    });
    return toProductMetadata({
      productId: id,
      title: `${productMetaData.title} | ${SHOP_SITE_NAME}`,
      description: extractProductMetaDescriptionFromHtml(
        productMetaData.description,
        productMetaData.title,
      ),
      image: productMetaData.image,
      price: productMetaData.retail_price,
    });
  }

  const liveProductMetaData = await getDevLiveProductMetadata(id);
  if (liveProductMetaData) {
    recordShopMetadataSource({
      targetKind: 'product',
      targetId: id,
      source: 'dev_live',
      startedAt,
      shouldIndex: true,
    });
    return toProductMetadata({
      productId: id,
      title: `${liveProductMetaData.title} | ${SHOP_SITE_NAME}`,
      description: extractProductMetaDescriptionFromHtml(
        liveProductMetaData.description,
        liveProductMetaData.title,
      ),
      image: liveProductMetaData.image,
      price: liveProductMetaData.retail_price,
    });
  }

  const publishedProductFallback = getPublishedShopProductPreview(id);
  recordShopMetadataSource({
    targetKind: 'product',
    targetId: id,
    source: publishedProductFallback ? 'published_fallback' : 'unknown_noindex',
    startedAt,
    shouldIndex: Boolean(publishedProductFallback),
  });
  return getSnapshotMissProductMetadata(id);
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

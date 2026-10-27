import ProductDetailsShell from '@/components/UI/Shop/ProductDetails/ProductDetailsShell';
import { Metadata } from 'next';
import { getProductMetaDataOnly, merchizeAPIKey, merchizeBaseURL } from './productDetailsSSR';
import { notFound } from 'next/navigation';
import serialize from 'serialize-javascript';
import { extractProductMetaDescriptionFromHtml } from '@/lib/utils/extract-plain-text-from-html';
import {
  assertBasicStorefrontProductData,
  getBasicProductFromSnapshot,
  getProductVariantsFromSnapshot,
} from '@/lib/merchizeStorefront/snapshot';
import {
  coerceMerchizeProviderError,
  fetchMerchizeJson,
} from '@/lib/merchizeStorefront/providerErrors';
import type { BasicProductInterface } from '@/lib/merchizeStorefront/productTypes';
import { ProductDescriptionSection } from '@/components/UI/Shop/ProductDetails/ProductStaticSections';
import { getShopSiteUrl } from '@/lib/siteBaseUrls';
import { getPublishedShopProductPreview } from '@/lib/utils/shopHomePageProductsData';
import { readProductSeoManifestEntry } from '@/lib/shop/seoManifest/read';
import type { ProductSeoManifestEntry } from '@/lib/shop/seoManifest/types';
import { recordShopMetadataSource } from '@/lib/shop/seoManifest/metadataObservability';
import { resolveProductGalleryImages } from '@/lib/merchizeStorefront/imageUrls';
import { getProductOptionLayout } from '@/lib/merchizeStorefront/productOptionLayout';
import { STRICT_STOREFRONT_PROVIDER_TIMEOUT_MS } from '@/lib/merchizeStorefront/strictLiveProduct';
import { getProductStructuredData } from '@/lib/merchizeStorefront/productStructuredData';

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
  const url = resolveProductGalleryImages({ metadata: { image } })[0];
  return url?.startsWith('/') ? getShopSiteUrl(url) : url;
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
      { timeoutMs: STRICT_STOREFRONT_PROVIDER_TIMEOUT_MS },
    );
    return assertBasicStorefrontProductData(json.data, `Merchize product ${productId}`);
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

const ProductDetails = async ({ params }: PageProps) => {
  const { id: productID } = await params;

  const [productMetaData, displayVariants] = await Promise.all([
    getProductMetaDataOnly(productID).catch((error) => {
      if (coerceMerchizeProviderError(error)?.kind === 'not_found') notFound();
      throw error;
    }),
    getProductVariantsFromSnapshot(productID).catch(() => null),
  ]);

  const { description, title } = productMetaData;
  const optionLayoutHints = getProductOptionLayout(displayVariants ?? []);

  // Saved images are display hints only; purchase options still require live verification.
  const initialImageUrls = resolveProductGalleryImages({
    metadata: productMetaData,
    variants: displayVariants,
    fallbackImageUrl: getPublishedShopProductPreview(productID)?.imagePath,
  });
  const firstImageUrl = resolveProductImageUrl(initialImageUrls[0]);
  const clientProductMetaData = {
    ...productMetaData,
    description: '',
  };
  const trimmedDescription = extractProductMetaDescriptionFromHtml(description, title);

  const productStructuredData = serialize(
    getProductStructuredData({
      product: productMetaData,
      description: trimmedDescription,
      image: firstImageUrl,
      url: getShopSiteUrl(`/product/${encodeURIComponent(productMetaData._id)}`),
    }),
  );

  return (
    <>
      <ProductDetailsShell
        productId={productID}
        fetchedProductData={{ productMetaData: clientProductMetaData, productVariants: [] }}
        initialImageUrls={initialImageUrls}
        optionLayoutHints={optionLayoutHints}
        descriptionSection={<ProductDescriptionSection description={description} />}
      />
      <script type='application/ld+json'>{productStructuredData}</script>
    </>
  );
};

export default ProductDetails;

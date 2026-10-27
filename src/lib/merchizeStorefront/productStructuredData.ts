import type { BasicProductInterface } from './productTypes';
import { isMerchizeStorefrontProductAvailable } from '@/lib/paypal/orderSnapshot/merchizeAvailability';

export function getProductStructuredData({
  product,
  description,
  image,
  url,
}: {
  product: BasicProductInterface['data'];
  description: string;
  image?: string;
  url: string;
}) {
  const price = Number(product.retail_price);
  const hasListedOffer =
    Number.isFinite(price) && price > 0 && isMerchizeStorefrontProductAvailable(product);

  return {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.title,
    url,
    ...(image ? { image } : {}),
    description,
    brand: { '@type': 'Brand', name: 'Codex Christi' },
    // A published listing does not prove current stock or delivery availability.
    ...(hasListedOffer
      ? {
          offers: { '@type': 'Offer', url, price: String(price), priceCurrency: 'USD' },
        }
      : {}),
  };
}

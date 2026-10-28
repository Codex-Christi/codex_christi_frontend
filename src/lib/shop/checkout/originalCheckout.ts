import type { ShopCheckoutStoreInterface } from '@/stores/shop_stores/checkoutStore';

/** Display-only projection of one existing, payment-authorized checkout. */
export type OriginalCheckout = {
  orderToken: string;
  paypalOrderId: string;
  reviewKey: string;
  customer: { name: string; email: string };
  deliveryAddress: ShopCheckoutStoreInterface['delivery_address'];
  countryCode: string;
  quote: { currency: string; subtotal: number; shipping: number; total: number };
  lines: {
    id: string;
    title: string;
    image: string | null;
    quantity: number;
    options: string;
    unitAmount: string;
    lineAmount: string;
  }[];
};

import type { OrderResponseBody } from '@paypal/paypal-js';
import type { OrdersCapture } from '@paypal/paypal-server-sdk';
import type { CreateOrderActionInterface } from '@/lib/paypal/createPayPalOrder';
import type { CartVariant } from '@/stores/shop_stores/cartStore';

export interface CompletedTxInterface {
  authData: OrderResponseBody;
  capturedOrder: OrdersCapture;
  cart: CartVariant[];
  userId?: string | null;
  customer: CreateOrderActionInterface['customer'];
  delivery_address: CreateOrderActionInterface['delivery_address'];
  ORD_string: string;
  country_iso2: string;
}

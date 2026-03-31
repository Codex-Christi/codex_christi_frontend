'use server';
import { decrypt } from '@/stores/shop_stores/cartStore';
import { createPayPalOrder } from '@/lib/paypal/createPayPalOrder';
import type { CreateOrderActionInterface } from '@/lib/paypal/createPayPalOrder';
import 'server-only';

export const createOrderAction = async (encodedData: string) => {
  // Destructure
  const decodedData = JSON.parse(decrypt(encodedData)) as CreateOrderActionInterface;

  return createPayPalOrder(decodedData);
};

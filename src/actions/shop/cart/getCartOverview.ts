'use server';

import type { CartVariant } from '@/stores/shop_stores/cartStore';
import { resolveCartOverview } from '@/lib/merchizeStorefront/cartOverview';

export async function getCartOverview(cart: CartVariant[], countryIso3 = 'USA') {
  return resolveCartOverview(cart, countryIso3.toUpperCase());
}

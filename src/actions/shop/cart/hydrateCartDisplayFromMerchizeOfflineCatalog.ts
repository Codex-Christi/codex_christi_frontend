'use server';

import type { CartVariant } from '@/stores/shop_stores/cartStore';
import { verifyCartDisplay } from '@/lib/merchizeStorefront/cartVerification';

export async function hydrateCartDisplayFromMerchizeOfflineCatalog(cart: CartVariant[]) {
  return verifyCartDisplay(cart);
}

export async function validateCartItemForQuantityIncrease(cartItem: CartVariant) {
  const result = await verifyCartDisplay([cartItem]);
  return result.availabilityByVariantId[cartItem.variantId] ?? { status: 'unverified' as const };
}

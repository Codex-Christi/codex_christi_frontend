'use server';

import type { CartVariant } from '@/stores/shop_stores/cartStore';
import { resolveCartOverview } from '@/lib/merchizeStorefront/cartOverview';
import { currencyCodesWithoutDecimalPrecision } from '@/datasets/shop_general/paypal_currency_specifics';

export const removeOrKeepDecimalPrecision = async (currency: string, number: number) =>
  currencyCodesWithoutDecimalPrecision.includes(currency)
    ? Number(number.toFixed(0))
    : Math.round(number * 100) / 100;

export async function getMerchizeTotalWIthShipping(
  cart: CartVariant[],
  countryIso3: string,
  _opts?: { state_iso2?: string },
) {
  void _opts;
  const result = await resolveCartOverview(cart, countryIso3.toUpperCase());
  if (!result.totals)
    throw new Error(result.quoteError ?? 'Cart availability could not be verified.');
  return result.totals;
}

'use server';

import { resolveCartOverview } from '@/lib/merchizeStorefront/cartOverview';
import {
  dropShippingSupplier,
  getCountrySupport,
  ShippingCountryObj,
} from '@/lib/datasetSearchers/shippingSupportMerchize';
import { CartVariant } from '@/stores/shop_stores/cartStore';
import { cache } from 'react';
import { hasCheckoutBlockingCartItems } from '@/components/UI/Shop/Cart/cartAvailability';

export const getOrderFinalDetails = cache(
  async (
    cart: CartVariant[],
    country_iso3: ShippingCountryObj['country_iso3'],
    supplier: dropShippingSupplier,
  ) => {
    const verifiedCart = await resolveCartOverview(cart, country_iso3.toUpperCase());
    if (hasCheckoutBlockingCartItems(cart, verifiedCart.availabilityByVariantId)) {
      throw new Error('One or more cart variants are unavailable or could not be verified.');
    }
    if (!verifiedCart.totals)
      throw new Error(verifiedCart.quoteError ?? 'Pricing could not be verified.');
    const countrySupport = await getCountrySupport(country_iso3, supplier);
    const finalPricesWithShippingFee = verifiedCart.totals;

    return { countrySupport, finalPricesWithShippingFee };
  },
);

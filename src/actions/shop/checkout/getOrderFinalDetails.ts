'use server';

import { getMerchizeTotalWIthShipping } from '@/actions/merchize/getMerchizeTotalWithShipping';
import {
  dropShippingSupplier,
  getCountrySupport,
  ShippingCountryObj,
} from '@/lib/datasetSearchers/shippingSupportMerchize';
import { CartVariant } from '@/stores/shop_stores/cartStore';

export const getOrderFinalDetails = async (
  cart: CartVariant[],
  country_iso3: ShippingCountryObj['country_iso3'],
  supplier: dropShippingSupplier
) => {
  const countrySupport = await getCountrySupport(country_iso3, supplier);
  const finalPricesWithDelivery = await getMerchizeTotalWIthShipping(
    cart,
    country_iso3
  );

  return { countrySupport, finalPricesWithDelivery };
};

'use server';

import { ShippingCountryObj } from '@/lib/datasetSearchers/shippingSupportMerchize';
import { CartVariant } from '@/stores/shop_stores/cartStore';
import { getCatalogItems } from './getItemCatalogInfo';
import { CatalogItem } from '@/lib/datasetSearchers/merchize/catalog';
import { europeanIso3Codes } from '@/datasets/shop_general/europeISO3Codes';
import { getDollarMultiplier } from '../shop/general/currencyConvert';

export const getMerchizeTotalWIthShipping = async (
  cart: CartVariant[],
  country_iso3: ShippingCountryObj['country_iso3']
) => {
  const filt = cart.flatMap(({ itemDetail, quantity }) => {
    return Array(quantity).fill(itemDetail.sku);
  });
  if (filt) {
    const cartSKUCatalogShippingData = await getCatalogItems(
      filt ? filt.filter((sku): sku is string => typeof sku === 'string') : ['']
    );

    const shippingPriceObj = await getShippingPriceMerchizecatalog(
      cartSKUCatalogShippingData,
      country_iso3
    );

    const variantwithCorrespondingParentProduct =
      // Filtering the cart to only include items that are in the SKU catalog
      //   'Filtered Cart Items:',
      cart
        .filter((item) => {
          const { sku } = item.itemDetail;
          return cartSKUCatalogShippingData
            ?.flatMap((item) => item.SKU_variant)
            .includes(sku ? sku : '');
        })
        // Mapping the filtered cart items to get variantId and parentID
        .map((product) => {
          const { variantId, itemDetail } = product;
          return { variantId, parentID: itemDetail.product };
        });

    return { ...shippingPriceObj };
  }
};

// Function to calculate shipping price based on catalog items and country
// This function calculates the total shipping price based on the catalog items and the country ISO3 code.
// It uses the catalog items to determine the shipping fees based on the region (US, EU, or ROW).
export const getShippingPriceMerchizecatalog = async (
  catalogArr: CatalogItem[],
  country_iso3: ShippingCountryObj['country_iso3']
) => {
  let current_sku = '';
  const regionShippingKey =
    country_iso3.toUpperCase() === 'USA'
      ? 'US'
      : europeanIso3Codes.includes(country_iso3)
        ? 'EU'
        : 'ROW';
  const shippingPriceServer = catalogArr.reduce((acc, currentVariant) => {
    if (currentVariant && current_sku === currentVariant.SKU_variant) {
      current_sku = currentVariant.SKU_variant;
      return (
        (currentVariant[`${regionShippingKey}_additional_shipping_fee`] ?? 0) +
        acc
      );
    } else {
      current_sku = currentVariant.SKU_variant;
      return (currentVariant[`${regionShippingKey}_shipping_fee`] ?? 0) + acc;
    }
  }, 0);

  const shippingNum = Math.ceil(shippingPriceServer);

  const dollarMultiplierResult = await getDollarMultiplier(country_iso3);
  let shippingPriceNum: number | null = null;
  if ('multiplier' in dollarMultiplierResult) {
    shippingPriceNum = dollarMultiplierResult.multiplier * shippingNum;
  } else {
    // Handle error case, e.g., set shippingPriceNum to 0 or null
    shippingPriceNum = shippingNum * 1.5;
    // Optionally, you can log or throw the error
    // console.error(dollarMultiplierResult.error);
  }

  return {
    shippingPriceNum: Math.ceil(shippingPriceNum * 100) / 100,
    currency: dollarMultiplierResult.currency,
  };
};

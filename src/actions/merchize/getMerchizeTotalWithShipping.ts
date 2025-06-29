'use server';
// 'use cache';

import { ShippingCountryObj } from '@/lib/datasetSearchers/shippingSupportMerchize';
import { CartVariant } from '@/stores/shop_stores/cartStore';
import { getCatalogItems } from './getItemCatalogInfo';
import { CatalogItem } from '@/lib/datasetSearchers/merchize/catalog';
import { europeanIso3Codes } from '@/datasets/shop_general/europeISO3Codes';
import { getDollarMultiplier } from '../shop/general/currencyConvert';
import { cache } from 'react';

const merchizeAPIKey = process.env.MERRCHIZE_API_KEY!;
const merchizeBaseURL = process.env.MERCHIZE_BASE_URL;

// Calculates total price (including shipping) for a Merchize cart
export const getMerchizeTotalWIthShipping = cache(
  async (
    cart: CartVariant[],
    country_iso3: ShippingCountryObj['country_iso3']
  ) => {
    const filt = cart.flatMap(({ itemDetail, quantity }) => {
      return Array(quantity).fill(itemDetail.sku);
    });

    if (filt) {
      const cartSKUCatalogShippingData = await getCatalogItems(
        filt.filter((sku): sku is string => typeof sku === 'string')
      );

      const shippingPriceObj = await getShippingPriceMerchizecatalog(
        cartSKUCatalogShippingData,
        country_iso3
      );

      const variantsWithCorrespondingParentProduct = (() => {
        const skuSet = cartSKUCatalogShippingData?.map(({ SKU_variant }) => {
          const matchingCartProduct = cart.find(
            (item) => item.itemDetail.sku === SKU_variant
          );
          const { variantId, itemDetail } = matchingCartProduct ?? {};
          const { product } = itemDetail ?? {};
          return { variantId, parentProductID: product };
        });

        return skuSet;
      })();

      const realTimePriceTotal = await realTimePriceFromMerchize(
        variantsWithCorrespondingParentProduct,
        country_iso3
      );

      return { ...shippingPriceObj, ...realTimePriceTotal };
    }
  }
);

// Calculates shipping price for catalog items and country
export const getShippingPriceMerchizecatalog = cache(
  async (
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
          (currentVariant[`${regionShippingKey}_additional_shipping_fee`] ??
            0) + acc
        );
      } else {
        current_sku = currentVariant.SKU_variant;
        return (currentVariant[`${regionShippingKey}_shipping_fee`] ?? 0) + acc;
      }
    }, 0);

    const shippingNum =
      shippingPriceServer < 15 ? 15 : Math.ceil(shippingPriceServer);

    const dollarMultiplierResult = await getDollarMultiplier(country_iso3);

    let shippingPriceNum: number | null = null;

    if ('multiplier' in dollarMultiplierResult) {
      shippingPriceNum = (dollarMultiplierResult.multiplier ?? 1) * shippingNum;
    } else if (dollarMultiplierResult && typeof shippingNum === 'number') {
      shippingPriceNum = shippingNum * 1.5;
    } else {
      shippingPriceNum = 0;
    }

    return {
      multiplier: dollarMultiplierResult.multiplier,
      shippingPriceNum: Math.ceil((shippingPriceNum ?? 0) * 100) / 100,
      currency: dollarMultiplierResult.currency,
    };
  }
);

// Fetches real-time retail price total for variants from Merchize API
const realTimePriceFromMerchize = cache(
  async (
    variantsAndParents: {
      variantId: string | undefined;
      parentProductID: string | undefined;
    }[],
    country_iso3: ShippingCountryObj['country_iso3']
  ) => {
    const requests = variantsAndParents
      .filter(({ parentProductID }) => merchizeBaseURL && parentProductID)
      .map((obj) => {
        const { parentProductID } = obj;

        return fetch(
          `${merchizeBaseURL}/product/products/${parentProductID}/variants/search`,
          {
            method: 'POST',
            headers: { 'X-API-KEY': `${merchizeAPIKey}` },
            next: { revalidate: 3600 },
          }
        );
      });

    if (requests.length !== variantsAndParents.length) {
      console.warn(
        'Some variants were skipped due to missing merchizeBaseURL or parentProductID.'
      );
    }

    try {
      const responses = await Promise.all(requests);

      type MerchizeVariant = {
        _id: string;
        retail_price?: number;
      };

      type MerchizeApiResponse = {
        data?: {
          variants?: MerchizeVariant[];
        };
      };

      const data: MerchizeApiResponse[] = await Promise.all(
        responses.map((res) => res.json())
      );

      const reducedPriceUSD = Math.ceil(
        data
          .map((resp, index) => {
            const variants = resp.data?.variants ?? [];
            return variants.find(
              (obj) => obj._id === variantsAndParents[index]['variantId']
            );
          })
          .reduce((accum, variant) => {
            return accum + (variant?.retail_price ?? 0);
          }, 0)
      );

      const dollarMultiplierResult = await getDollarMultiplier(country_iso3);

      let realTimePriceTotal: number;
      if (
        'multiplier' in dollarMultiplierResult &&
        typeof dollarMultiplierResult.multiplier === 'number'
      ) {
        realTimePriceTotal =
          Math.ceil(
            reducedPriceUSD * (dollarMultiplierResult.multiplier ?? 1) * 100
          ) / 100;
      } else {
        realTimePriceTotal = reducedPriceUSD;
      }

      return {
        retailPriceTotalNum: realTimePriceTotal,
        currency: dollarMultiplierResult.currency,
        currency_symbol:
          'currency_symbol' in dollarMultiplierResult
            ? dollarMultiplierResult.currency_symbol
            : undefined,
      };
    } catch (error) {
      console.error('Next.js Fetch API Error:', error);
      throw error;
    }
  }
);

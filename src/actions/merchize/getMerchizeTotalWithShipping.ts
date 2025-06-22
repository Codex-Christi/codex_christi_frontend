/**
 * @fileoverview
 * Provides functions to calculate the total price (including shipping) for a Merchize cart,
 * fetch shipping prices based on catalog items and country, and retrieve real-time product prices
 * from the Merchize API.
 */

'use server';

/**
 * Imports the ShippingCountryObj type for country ISO3 code typing.
 */
import { ShippingCountryObj } from '@/lib/datasetSearchers/shippingSupportMerchize';

/**
 * Imports the CartVariant type representing items in the cart.
 */
import { CartVariant } from '@/stores/shop_stores/cartStore';

/**
 * Imports a function to fetch catalog items by SKU.
 */
import { getCatalogItems } from './getItemCatalogInfo';

/**
 * Imports the CatalogItem type representing a product variant in the Merchize catalog.
 */
import { CatalogItem } from '@/lib/datasetSearchers/merchize/catalog';

/**
 * Imports a list of European ISO3 country codes.
 */
import { europeanIso3Codes } from '@/datasets/shop_general/europeISO3Codes';

/**
 * Imports a function to get the currency conversion multiplier for a given country.
 */
import { getDollarMultiplier } from '../shop/general/currencyConvert';

/**
 * The Merchize API key, loaded from environment variables.
 */
const merchizeAPIKey = process.env.MERRCHIZE_API_KEY!;

/**
 * The base URL for the Merchize API, loaded from environment variables.
 */
const merchizeBaseURL = process.env.MERCHIZE_BASE_URL;

/**
 * Calculates the total price (including shipping) for a Merchize cart.
 *
 * @param cart - The array of cart variants to calculate the total for.
 * @param country_iso3 - The ISO3 code of the shipping country.
 * @returns An object containing shipping price, currency, and real-time price total.
 */
export const getMerchizeTotalWIthShipping = async (
  cart: CartVariant[],
  country_iso3: ShippingCountryObj['country_iso3']
) => {
  /**
   * Flattens the cart into an array of SKUs, repeating each SKU by its quantity.
   */
  const filt = cart.flatMap(({ itemDetail, quantity }) => {
    return Array(quantity).fill(itemDetail.sku);
  });

  if (filt) {
    /**
     * Fetches catalog data for all SKUs in the cart.
     */
    const cartSKUCatalogShippingData = await getCatalogItems(
      filt.filter((sku): sku is string => typeof sku === 'string')
    );

    /**
     * Calculates the shipping price for the catalog items and country.
     */
    const shippingPriceObj = await getShippingPriceMerchizecatalog(
      cartSKUCatalogShippingData,
      country_iso3
    );

    /**
     * Filters the cart to only include items present in the SKU catalog,
     * and maps them to their variant and parent product IDs.
     */
    const variantsWithCorrespondingParentProduct = (() => {
      const skuSet = new Set(
        cartSKUCatalogShippingData?.flatMap((item) => item.SKU_variant) ?? []
      );
      return cart
        .filter((item) => {
          const { sku } = item.itemDetail;
          return skuSet.has(sku ?? '');
        })
        .map((product) => {
          const { variantId, itemDetail } = product;
          return { variantId, parentProductID: itemDetail.product };
        });
    })();

    /**
     * Fetches the real-time price total for the variants in the cart.
     */
    const realTimePriceTotal = await realTimePriceFromMerchize(
      variantsWithCorrespondingParentProduct,
      country_iso3
    );

    /**
     * Returns the combined shipping price and real-time price total.
     */
    return { ...shippingPriceObj, ...realTimePriceTotal };
  }
};

/**
 * Calculates the total shipping price for a set of catalog items and a country.
 *
 * @param catalogArr - The array of catalog items to calculate shipping for.
 * @param country_iso3 - The ISO3 code of the shipping country.
 * @returns An object containing the shipping price and currency.
 */
export const getShippingPriceMerchizecatalog = async (
  catalogArr: CatalogItem[],
  country_iso3: ShippingCountryObj['country_iso3']
) => {
  /**
   * Tracks the current SKU to determine if an item is the first or additional in the cart.
   */
  let current_sku = '';

  /**
   * Determines the shipping region key (US, EU, or ROW) based on the country ISO3 code.
   */
  const regionShippingKey =
    country_iso3.toUpperCase() === 'USA'
      ? 'US'
      : europeanIso3Codes.includes(country_iso3)
        ? 'EU'
        : 'ROW';

  /**
   * Reduces the catalog array to calculate the total shipping fee for the region.
   */
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

  /**
   * Rounds up the shipping price to the nearest integer.
   */
  const shippingNum = Math.ceil(shippingPriceServer);

  /**
   * Fetches the currency conversion multiplier for the country.
   */
  const dollarMultiplierResult = await getDollarMultiplier(country_iso3);

  /**
   * The final shipping price in the target currency.
   */
  let shippingPriceNum: number | null = null;

  if ('multiplier' in dollarMultiplierResult) {
    shippingPriceNum = (dollarMultiplierResult.multiplier ?? 1) * shippingNum;
  } else if (dollarMultiplierResult && typeof shippingNum === 'number') {
    // Handle error case, e.g., set shippingPriceNum to a fallback value
    shippingPriceNum = shippingNum * 1.5;
    // Optionally, you can log or throw the error
    // console.error(dollarMultiplierResult.error);
  } else {
    shippingPriceNum = 0;
  }

  /**
   * Returns the shipping price (rounded to two decimals) and currency.
   */
  return {
    shippingPriceNum: Math.ceil((shippingPriceNum ?? 0) * 100) / 100,
    currency: dollarMultiplierResult.currency,
  };
};

/**
 * Fetches the real-time retail price total for a set of variants from the Merchize API.
 *
 * @param variantsAndParents - Array of objects containing variantId and parentProductID.
 * @param country_iso3 - The ISO3 code of the shipping country.
 * @returns An object containing the total retail price and currency.
 * @throws Will throw an error if the fetch or JSON parsing fails.
 */
const realTimePriceFromMerchize = async (
  variantsAndParents: {
    variantId: string;
    parentProductID: string | undefined;
  }[],
  country_iso3: ShippingCountryObj['country_iso3']
) => {
  /**
   * Builds an array of fetch requests for each variant's parent product.
   */
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

  /**
   * Warns if any variants were skipped due to missing data.
   */
  if (requests.length !== variantsAndParents.length) {
    console.warn(
      'Some variants were skipped due to missing merchizeBaseURL or parentProductID.'
    );
  }

  try {
    /**
     * Waits for all fetch requests to complete.
     */
    const responses = await Promise.all(requests);

    /**
     * Type representing a Merchize variant object.
     */
    type MerchizeVariant = {
      _id: string;
      retail_price?: number;
      // add other fields as needed
    };

    /**
     * Type representing the Merchize API response structure.
     */
    type MerchizeApiResponse = {
      data?: {
        variants?: MerchizeVariant[];
      };
    };

    /**
     * Parses all responses as JSON.
     */
    const data: MerchizeApiResponse[] = await Promise.all(
      responses.map((res) => res.json())
    );

    /**
     * Sums the retail prices of the requested variants (in USD).
     */
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

    /**
     * Fetches the currency conversion multiplier for the country.
     */
    const dollarMultiplierResult = await getDollarMultiplier(country_iso3);

    /**
     * The final real-time price total in the target currency.
     */
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

    /**
     * Returns the real-time retail price total and currency.
     */
    return {
      retailPriceTotalNum: realTimePriceTotal,
      currency: dollarMultiplierResult.currency,
      currency_symbol:
        'currency_symbol' in dollarMultiplierResult
          ? dollarMultiplierResult.currency_symbol
          : undefined,
    };
  } catch (error) {
    /**
     * Logs and rethrows any errors encountered during the fetch or parsing process.
     */
    console.error('Next.js Fetch API Error:', error);
    throw error;
  }
};

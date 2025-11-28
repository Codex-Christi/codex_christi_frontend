// src/actions/merchize/getMerchizeTotalWithShipping.ts
'use server';

import { cache } from 'react';
import { ShippingCountryObj } from '@/lib/datasetSearchers/shippingSupportMerchize';
import { CartVariant } from '@/stores/shop_stores/cartStore';
import { getCatalogItems } from './getItemCatalogInfo';
import { currencyCodesWithoutDecimalPrecision } from '@/datasets/shop_general/paypal_currency_specifics';
import { symbolFromCurrency } from '@/lib/currency/symbol';
import { getShippingPriceMerchizecatalog, realTimePriceFromMerchize } from './priceFromMerchize';

function expandByQuantity<T>(cart: CartVariant[], fn: (item: CartVariant) => T): T[] {
  return cart.flatMap((item) => Array.from({ length: item.quantity }, () => fn(item)));
}

export type VariantUnitMeta = {
  variantId: string | undefined;
  parentProductID: string | undefined;
  unitPriceUSD?: number;
};

export const removeOrKeepDecimalPrecision = async (curr: string, num: number) =>
  currencyCodesWithoutDecimalPrecision.includes(curr ?? 'USD')
    ? Number(num.toFixed(0))
    : Math.round((num + Number.EPSILON) * 100) / 100;

export const getMerchizeTotalWIthShipping = cache(
  async (
    cart: CartVariant[],
    country_iso3: ShippingCountryObj['country_iso3'],
    opts?: { state_iso2?: string },
  ) => {
    // Expand cart by quantity → ['SKU1', 'SKU1', 'SKU2', ...]
    const skus = expandByQuantity(cart, ({ itemDetail }) => itemDetail.sku).filter(
      (v): v is string => Boolean(v),
    );

    if (!skus.length) {
      return {
        shippingPriceNum: 0,
        retailPriceTotalNum: 0,
        currency: 'USD',
        currency_symbol: '$',
        multiplier: null as number | null,
      };
    }

    let catalogRows;
    try {
      // ⬇️ now hits Prisma DB via getItemCatalogInfo.ts, not JSON
      catalogRows = await getCatalogItems(skus, country_iso3);
    } catch (e) {
      throw e;
    }

    // console.debug('[AUDIT] Cart SKUs expanded (one per unit):', skus);
    const shippingPriceObj = await getShippingPriceMerchizecatalog(catalogRows, country_iso3, {
      ...opts,
      originalSkus: skus,
    });

    const variantsAndParents: VariantUnitMeta[] = expandByQuantity(
      cart,
      ({ itemDetail, variantId }) => ({
        variantId,
        parentProductID: itemDetail?.product,
        unitPriceUSD:
          typeof itemDetail.retail_price === 'number' ? itemDetail.retail_price : undefined,
      }),
    );

    const realTimePriceTotal = await realTimePriceFromMerchize(variantsAndParents, country_iso3);

    const currency = shippingPriceObj.currency || realTimePriceTotal.currency || 'USD';
    const currency_symbol =
      shippingPriceObj.currency_symbol ??
      realTimePriceTotal.currency_symbol ??
      symbolFromCurrency(currency);

    return {
      ...shippingPriceObj,
      ...realTimePriceTotal,
      currency,
      currency_symbol,
      shippingPriceNum: Number(
        await removeOrKeepDecimalPrecision(currency, shippingPriceObj.shippingPriceNum),
      ),
      retailPriceTotalNum: Number(
        await removeOrKeepDecimalPrecision(currency, realTimePriceTotal.retailPriceTotalNum),
      ),
    };
  },
);

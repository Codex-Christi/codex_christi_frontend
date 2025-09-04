// src/actions/merchize/getTotals.ts
'use server';

import { cache } from 'react';
import { ShippingCountryObj } from '@/lib/datasetSearchers/shippingSupportMerchize';
import { CartVariant } from '@/stores/shop_stores/cartStore';
import { getCatalogItems } from './getItemCatalogInfo';
import {
  iso3ToDest,
  isUSPostServiceSurchargeState,
} from '@/lib/datasetSearchers/merchize/dest-map';
import { getDollarMultiplier } from '../shop/general/currencyConvert';
import { currencyCodesWithoutDecimalPrecision } from '@/datasets/shop_general/paypal_currency_specifics';
import { loadNormalizedRows } from '@/lib/datasetSearchers/merchize/shipping.data';
import { symbolFromCurrency } from '@/lib/currency/symbol';

interface FXResult {
  currency?: string | null;
  multiplier?: number | null;
  currency_symbol?: string | null;
}
function asFX(x: unknown): FXResult {
  const o = typeof x === 'object' && x !== null ? (x as Record<string, unknown>) : {};
  return {
    currency: typeof o['currency'] === 'string' ? (o['currency'] as string) : null,
    multiplier: typeof o['multiplier'] === 'number' ? (o['multiplier'] as number) : null,
    currency_symbol:
      typeof o['currency_symbol'] === 'string' ? (o['currency_symbol'] as string) : null,
  };
}
function countBy<T extends string>(arr: T[]) {
  const m = new Map<T, number>();
  for (const v of arr) m.set(v, (m.get(v) ?? 0) + 1);
  return m;
}
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
    const skus = cart.flatMap(
      ({ itemDetail, quantity }) =>
        Array.from({ length: quantity }, () => itemDetail.sku).filter(Boolean) as string[],
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

    // Substring-prefix resolution (throws if any cannot be matched)
    let catalogRows;
    try {
      catalogRows = await getCatalogItems(skus, country_iso3);
    } catch (e) {
      const err = e as Error & { code?: string; misses?: string[] };
      if (err.code === 'SKU_PREFIX_NO_MATCH') {
        const detail = err.misses?.length ? ` Missing: ${err.misses.join(', ')}` : '';
        throw new Error(`Failed to resolve one or more SKUs via prefix matching.${detail}`);
      }
      throw err;
    }

    const shippingPriceObj = await getShippingPriceMerchizecatalog(catalogRows, country_iso3, opts);

    const variantsAndParents = cart.map(({ itemDetail, variantId }) => ({
      variantId,
      parentProductID: itemDetail?.product,
    }));

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

export const getShippingPriceMerchizecatalog = cache(
  async (
    catalogArr: {
      SKU_variant: string;
      US_shipping_fee: number | null;
      US_additional_shipping_fee: number | null;
      EU_shipping_fee: number | null;
      EU_additional_shipping_fee: number | null;
      GB_shipping_fee?: number | null;
      GB_additional_shipping_fee?: number | null;
      CA_shipping_fee?: number | null;
      CA_additional_shipping_fee?: number | null;
      AU_shipping_fee?: number | null;
      AU_additional_shipping_fee?: number | null;
      ROW_shipping_fee: number | null;
      ROW_additional_shipping_fee: number | null;
    }[],
    country_iso3: ShippingCountryObj['country_iso3'],
    opts?: { state_iso2?: string; fallbackToROW?: boolean },
  ) => {
    const counts = countBy(catalogArr.map((c) => c.SKU_variant));
    const dest = iso3ToDest(country_iso3);
    const fallback = opts?.fallbackToROW ?? true;

    // O(1) by full SKU — because getCatalogItems set SKU_variant = YOUR full SKU
    const bySku = new Map(catalogArr.map((r) => [r.SKU_variant, r]));

    const normalized = await loadNormalizedRows();
    const extrasBySku = new Map(normalized.map((r) => [r.sku, r.extras ?? {}]));

    let sum = 0;
    for (const [sku, qty] of counts) {
      const row = bySku.get(sku);
      if (!row) {
        throw new Error(
          `Shipping bands missing for resolved SKU "${sku}". This indicates a mapping error.`,
        );
      }

      let first: number | null = null,
        addl: number | null = null;
      switch (dest) {
        case 'US':
          first = row.US_shipping_fee;
          addl = row.US_additional_shipping_fee;
          break;
        case 'EU':
          first = row.EU_shipping_fee;
          addl = row.EU_additional_shipping_fee;
          break;
        case 'GB':
          first = row.GB_shipping_fee ?? null;
          addl = row.GB_additional_shipping_fee ?? null;
          break;
        case 'CA':
          first = row.CA_shipping_fee ?? null;
          addl = row.CA_additional_shipping_fee ?? null;
          break;
        case 'AU':
          first = row.AU_shipping_fee ?? null;
          addl = row.AU_additional_shipping_fee ?? null;
          break;
        case 'ROW':
          first = row.ROW_shipping_fee;
          addl = row.ROW_additional_shipping_fee;
          break;
      }
      if ((first == null || Number.isNaN(first)) && fallback) {
        first = row.ROW_shipping_fee;
        addl = row.ROW_additional_shipping_fee;
      }
      if (first == null || Number.isNaN(first)) continue;

      const f = Number(first) || 0;
      const a = Number(addl ?? 0);
      let cost = f + Math.max(0, qty - 1) * a;

      if (dest === 'US' && opts?.state_iso2 && isUSPostServiceSurchargeState(opts.state_iso2)) {
        const extra = extrasBySku.get(sku) as Record<string, unknown> | undefined;
        const surcharge =
          typeof extra?.['us_post_service_added_fee'] === 'number'
            ? (extra['us_post_service_added_fee'] as number)
            : null;
        if (typeof surcharge === 'number') cost += surcharge;
      }
      sum += cost;
    }

    console.log('\nSum;', sum);

    const shippingNum = sum < 10 ? 10 : Math.ceil(sum);
    const fx = asFX(await getDollarMultiplier(country_iso3));
    const currency = fx.currency ?? 'USD';
    const currency_symbol = fx.currency_symbol ?? symbolFromCurrency(currency);
    const multiplier = typeof fx.multiplier === 'number' ? fx.multiplier : null;
    const priced = (multiplier ?? 1) * shippingNum;

    return {
      multiplier,
      shippingPriceNum: Math.ceil(priced * 100) / 100,
      currency,
      currency_symbol,
    };
  },
);

// Retail total (unchanged, typed FX)
const merchizeAPIKey = process.env.MERRCHIZE_API_KEY!;
const merchizeBaseURL = process.env.MERCHIZE_BASE_URL;
type MerchizeVariant = { _id: string; retail_price?: number };
type MerchizeApiResponse = { data?: { variants?: MerchizeVariant[] } };

export const realTimePriceFromMerchize = cache(
  async (
    variantsAndParents: { variantId: string | undefined; parentProductID: string | undefined }[],
    country_iso3: ShippingCountryObj['country_iso3'],
  ) => {
    const requests = variantsAndParents
      .filter(({ parentProductID }) => merchizeBaseURL && parentProductID)
      .map(({ parentProductID }) =>
        fetch(`${merchizeBaseURL}/product/products/${parentProductID}/variants/search`, {
          method: 'POST',
          headers: { 'X-API-KEY': `${merchizeAPIKey}` },
          next: { revalidate: 3600 },
        }),
      );

    try {
      const responses = await Promise.all(requests);
      const data: MerchizeApiResponse[] = await Promise.all(responses.map((res) => res.json()));
      const allVariants = data.map((resp, i) =>
        (resp.data?.variants ?? []).find((v) => v._id === variantsAndParents[i]?.variantId),
      );
      const reducedPriceUSD = allVariants.reduce((acc, v) => acc + (v?.retail_price ?? 0), 0);

      const fx = asFX(await getDollarMultiplier(country_iso3));
      const currency = fx.currency ?? 'USD';
      const currency_symbol = fx.currency_symbol ?? symbolFromCurrency(currency);
      const multiplier = typeof fx.multiplier === 'number' ? fx.multiplier : null;

      const total =
        typeof multiplier === 'number'
          ? Math.ceil(reducedPriceUSD * multiplier * 100) / 100
          : reducedPriceUSD;
      return { retailPriceTotalNum: total, currency, currency_symbol };
    } catch {
      const fx = asFX(await getDollarMultiplier(country_iso3));
      const currency = fx.currency ?? 'USD';
      const currency_symbol = fx.currency_symbol ?? symbolFromCurrency(currency);
      return { retailPriceTotalNum: 0, currency, currency_symbol };
    }
  },
);

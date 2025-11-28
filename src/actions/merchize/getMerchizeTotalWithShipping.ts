// src/actions/merchize/getMerchizeTotalWithShipping.ts
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

function expandByQuantity<T>(cart: CartVariant[], fn: (item: CartVariant) => T): T[] {
  return cart.flatMap((item) => Array.from({ length: item.quantity }, () => fn(item)));
}

type ShippingRow = {
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
};

type VariantUnitMeta = {
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

    const shippingPriceObj = await getShippingPriceMerchizecatalog(catalogRows, country_iso3, opts);

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

function resolveBand(
  row: ShippingRow,
  dest: ReturnType<typeof iso3ToDest>,
  fallbackToROW: boolean,
): { first: number | null; addl: number | null } {
  let first: number | null = null;
  let addl: number | null = null;

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

  if ((first == null || Number.isNaN(first)) && fallbackToROW) {
    first = row.ROW_shipping_fee;
    addl = row.ROW_additional_shipping_fee;
  }

  return { first, addl };
}

export const getShippingPriceMerchizecatalog = cache(
  async (
    catalogArr: ShippingRow[],
    country_iso3: ShippingCountryObj['country_iso3'],
    opts?: { state_iso2?: string; fallbackToROW?: boolean },
  ) => {
    const counts = countBy(catalogArr.map((c) => c.SKU_variant));
    const dest = iso3ToDest(country_iso3);
    const fallback = opts?.fallbackToROW ?? true;

    const bySku = new Map(catalogArr.map((r) => [r.SKU_variant, r]));
    const normalized = await loadNormalizedRows();
    const extrasBySku = new Map(normalized.map((r) => [r.sku, r.extras ?? {}]));

    const rowsForAverage = Array.from(bySku.values());

    // Pre-compute average first/additional band for this destination
    // to use as a fallback when a SKU is missing from the catalog DB.
    let avgFirst: number | null = null;
    let avgAddl: number | null = null;
    {
      let sumFirst = 0;
      let sumAddl = 0;
      let count = 0;
      for (const row of rowsForAverage) {
        const { first, addl } = resolveBand(row, dest, false); // no ROW fallback when averaging
        if (first != null && !Number.isNaN(first)) {
          sumFirst += Number(first);
          sumAddl += Number(addl ?? 0);
          count += 1;
        }
      }
      if (count > 0) {
        avgFirst = sumFirst / count;
        avgAddl = sumAddl / count;
      }
    }

    // number of SKUs in cart (expanded by quantity)
    const numOfSKUS = Array.from(counts.entries()).reduce((acc, [, qty]) => acc + qty, 0);

    const missingSkus: string[] = [];

    let sum = 0;
    for (const [sku, qty] of counts) {
      const row = bySku.get(sku);

      let first: number | null = null;
      let addl: number | null = null;

      if (row) {
        const band = resolveBand(row, dest, fallback);
        first = band.first;
        addl = band.addl;
      } else {
        // No row in DB for this SKU → use average band as fallback if available
        if (avgFirst != null) {
          missingSkus.push(sku);
          first = avgFirst;
          addl = avgAddl;
        } else {
          console.error(
            `[AUDIT] Missing catalog row for SKU ${sku} and no average band available for dest ${dest}`,
          );
        }
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
        if (surcharge !== null) {
          cost += surcharge;
        }
      }
      sum += cost;
    }

    if (missingSkus.length > 0) {
      console.warn(
        `[AUDIT] ${missingSkus.length} SKUs had no shipping bands in DB for dest ${dest}. ` +
          `Used average band as fallback for: ${missingSkus.join(', ')}`,
      );
    }

    // Your rule: if calculated sum < 5 * numOfSKUS (in USD),
    // fall back to 5 * numOfSKUS. Otherwise, use sum.
    const base = Math.max(sum, 5 * numOfSKUS);
    const fx = asFX(await getDollarMultiplier(country_iso3));
    const currency = fx.currency ?? 'USD';
    const currency_symbol = fx.currency_symbol ?? symbolFromCurrency(currency);
    const multiplier = typeof fx.multiplier === 'number' ? fx.multiplier : null;

    const priced =
      typeof multiplier === 'number'
        ? Math.ceil(base * multiplier * 100) / 100
        : Math.ceil(base * 100) / 100;

    return {
      multiplier,
      shippingPriceNum: priced,
      currency,
      currency_symbol,
    };
  },
);

// Retail total (unchanged, typed FX)
const merchizeAPIKey = process.env.MERCHIZE_API_KEY!;
const merchizeBaseURL = process.env.MERCHIZE_BASE_URL;
type MerchizeVariant = { _id: string; retail_price?: number };
type MerchizeApiResponse = { data?: { variants?: MerchizeVariant[] } };

export const realTimePriceFromMerchize = cache(
  async (
    variantsAndParents: VariantUnitMeta[],
    country_iso3: ShippingCountryObj['country_iso3'],
  ) => {
    // Base USD total across all units in the cart
    let reducedPriceUSD = 0;

    // 1) Variants that have no parentProductID can still contribute via unitPriceUSD
    const withoutParent = variantsAndParents.filter((v) => !v.parentProductID);
    if (withoutParent.length) {
      const fallbackSum = withoutParent.reduce(
        (acc, v) => acc + (typeof v.unitPriceUSD === 'number' ? v.unitPriceUSD : 0),
        0,
      );
      reducedPriceUSD += fallbackSum;
    }

    // 2) Variants that have a parentProductID → fetch from Merchize API
    const withParent = variantsAndParents.filter((v) => v.parentProductID && merchizeBaseURL);

    try {
      if (withParent.length) {
        const requests = withParent.map(({ parentProductID }) =>
          fetch(`${merchizeBaseURL}/product/products/${parentProductID}/variants/search`, {
            method: 'POST',
            headers: { 'X-API-KEY': `${merchizeAPIKey}` },
            next: { revalidate: 3600 },
          }),
        );

        const responses = await Promise.all(requests);
        const data: MerchizeApiResponse[] = await Promise.all(responses.map((res) => res.json()));

        // Align each response with the corresponding entry in withParent
        const apiSum = data.reduce((acc, resp, i) => {
          const meta = withParent[i];
          const candidates = resp.data?.variants ?? [];
          const match = candidates.find((v) => v._id === meta.variantId);
          const apiPrice = match?.retail_price;
          const fallback = typeof meta.unitPriceUSD === 'number' ? meta.unitPriceUSD : 0;
          return acc + (typeof apiPrice === 'number' ? apiPrice : fallback);
        }, 0);

        reducedPriceUSD += apiSum;
      }
    } catch (err) {
      console.error('[AUDIT] realTimePriceFromMerchize failed:', err);
      // If the API fails, we still keep whatever was accumulated so far (fallbacks)
    }

    const fx = asFX(await getDollarMultiplier(country_iso3));
    const currency = fx.currency ?? 'USD';
    const currency_symbol = fx.currency_symbol ?? symbolFromCurrency(currency);
    const multiplier = typeof fx.multiplier === 'number' ? fx.multiplier : null;

    const total =
      typeof multiplier === 'number'
        ? Math.ceil(reducedPriceUSD * multiplier * 100) / 100
        : reducedPriceUSD;

    return { retailPriceTotalNum: total, currency, currency_symbol };
  },
);

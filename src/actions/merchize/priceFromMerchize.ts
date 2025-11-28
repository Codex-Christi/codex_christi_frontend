import { symbolFromCurrency } from '@/lib/currency/symbol';
import { getDollarMultiplier } from '../shop/general/currencyConvert';
import { cache } from 'react';
import { ShippingCountryObj } from '@/lib/datasetSearchers/shippingSupportMerchize';
import { VariantUnitMeta } from './getMerchizeTotalWithShipping';
import {
  iso3ToDest,
  isUSPostServiceSurchargeState,
} from '@/lib/datasetSearchers/merchize/dest-map';
import { loadNormalizedRows } from '@/lib/datasetSearchers/merchize/shipping.data';

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

type ShippingDebugEntry = {
  sku: string;
  qty: number;
  dest: string;
  bandSource: 'DB' | 'FLAT_7';
  first: number;
  addl: number;
  cost: number;
};

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
    opts?: { state_iso2?: string; fallbackToROW?: boolean; originalSkus?: string[] },
  ) => {
    const computeBand = (
      row: ShippingRow | undefined,
      dest: ReturnType<typeof iso3ToDest>,
      fallbackToROW: boolean,
    ): { first: number; addl: number; bandSource: 'DB' | 'FLAT_7' } => {
      if (!row) {
        // No row in DB → flat fallback
        return { first: 7, addl: 5, bandSource: 'FLAT_7' };
      }

      const band = resolveBand(row, dest, fallbackToROW);
      const first = band.first;
      const addl = band.addl;

      if (first == null || Number.isNaN(first)) {
        // Bad or missing band even after ROW fallback → flat fallback
        return { first: 7, addl: 5, bandSource: 'FLAT_7' };
      }

      return {
        first: typeof first === 'number' ? first : 0,
        addl: typeof addl === 'number' ? addl : 0,
        bandSource: 'DB',
      };
    };

    const counts = countBy(
      (opts?.originalSkus ?? catalogArr.map((c) => c.SKU_variant)) as string[],
    );
    const dest = iso3ToDest(country_iso3);
    const fallback = opts?.fallbackToROW ?? true;

    const bySku = new Map(catalogArr.map((r) => [r.SKU_variant, r]));
    const normalized = await loadNormalizedRows();
    const extrasBySku = new Map(normalized.map((r) => [r.sku, r.extras ?? {}]));

    const missingSkus: string[] = [];
    const debugBreakdown: ShippingDebugEntry[] = [];

    let sum = 0;
    for (const [sku, qty] of counts) {
      const row = bySku.get(sku);
      const { first, addl, bandSource } = computeBand(row, dest, fallback);

      if (bandSource === 'FLAT_7') {
        missingSkus.push(sku);
      }

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

      debugBreakdown.push({
        sku,
        qty,
        dest,
        bandSource,
        first: f,
        addl: a,
        cost,
      });

      sum += cost;
    }

    if (missingSkus.length > 0) {
      console.warn(
        `[AUDIT] ${missingSkus.length} SKUs had no valid shipping bands in DB for dest ${dest}. ` +
          `Used flat $7 first-item / $5 additional fallback for: ${missingSkus.join(', ')}`,
      );
    }

    // console.debug('[AUDIT] Shipping breakdown per SKU:', JSON.stringify(debugBreakdown, null, 2));

    // Your rule: if calculated sum < 5 * numOfSKUS (in USD),
    // fall back to 5 * numOfSKUS. Otherwise, use sum.
    const numOfSKUS = Array.from(counts.entries()).reduce((acc, [, qty]) => acc + qty, 0);
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

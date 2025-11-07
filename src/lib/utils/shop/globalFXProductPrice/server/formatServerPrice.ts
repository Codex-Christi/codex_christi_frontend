import { readCurrencyCookieServer } from '@/lib/utils/shop/globalFXProductPrice/cookies/readServer';
import { getUSDCentsForProduct, getUSDCentsForProducts } from './priceResolver';

type Fx = { multiplier: number; currency: string; currency_symbol?: string };

function formatMajor(amount: number, fx: Fx) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: fx.currency }).format(
      amount,
    );
  } catch {
    return `${fx.currency_symbol || '$'} ${amount.toFixed(2)}`;
  }
}

/**
 * Get the SSR display string when you only know a USD amount (dollars).
 */
export async function formatServerPriceFromUSD(usdAmount: number): Promise<string | null> {
  const snap = await readCurrencyCookieServer();
  const fx = snap.fx as Fx | undefined;
  if (!fx) return null;

  const cents = Math.round(usdAmount * 100);
  const convertedCents = Math.round((cents / 100) * (fx.multiplier ?? 1) * 100);
  return formatMajor(convertedCents / 100, fx);
}

/**
 * For a single productId:
 * - Resolves USD base cents via cache
 * - Returns both the SSR text and the USD base cents so the client can live-recompute.
 */
export async function formatServerPriceForId(
  productId: string,
): Promise<{ ssrText: string | null; usdCentsBase: number | null }> {
  const snap = await readCurrencyCookieServer();
  const fx = snap.fx as Fx | undefined;
  const usdCents = await getUSDCentsForProduct(productId);
  if (!fx || usdCents == null) return { ssrText: null, usdCentsBase: usdCents };

  const convertedCents = Math.round((usdCents / 100) * (fx.multiplier ?? 1) * 100);
  return { ssrText: formatMajor(convertedCents / 100, fx), usdCentsBase: usdCents };
}

/**
 * Batch: for grids — returns { id -> { ssrText, usdCentsBase } }
 */
export async function formatServerPricesByIds(
  ids: string[],
): Promise<Record<string, { ssrText: string | null; usdCentsBase: number | null }>> {
  const snap = await readCurrencyCookieServer();
  const fx = snap.fx as Fx | undefined;
  const out: Record<string, { ssrText: string | null; usdCentsBase: number | null }> = {};

  const usdMap = await getUSDCentsForProducts(ids);
  for (const id of ids) {
    const usdCents = usdMap[id];
    if (!fx || usdCents == null) {
      out[id] = { ssrText: null, usdCentsBase: usdCents };
      continue;
    }
    const convertedCents = Math.round((usdCents / 100) * (fx.multiplier ?? 1) * 100);
    out[id] = { ssrText: formatMajor(convertedCents / 100, fx), usdCentsBase: usdCents };
  }
  return out;
}

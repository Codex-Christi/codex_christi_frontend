// utils/preloadUSDPrices.ts
import { fetchBaseProduct } from '@/app/shop/product/[id]/productDetailsSSR';

export async function preloadUSDPrices(productIds: string[]): Promise<Record<string, number>> {
  if (productIds.length === 0) return {};
  const pairs = await Promise.all(
    productIds.map(async (id) => {
      try {
        const data = await fetchBaseProduct(id); // BasicProductInterface['data']
        const major = parseFloat(data.retail_price ?? '0');
        const cents = Math.round(major * 100);
        return [id, cents] as const;
      } catch {
        return [id, null] as const;
      }
    }),
  );
  const out: Record<string, number> = {};
  for (const [id, cents] of pairs) if (typeof cents === 'number') out[id] = cents;
  return out;
}

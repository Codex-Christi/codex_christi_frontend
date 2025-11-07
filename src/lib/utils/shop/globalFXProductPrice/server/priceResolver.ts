import { cache } from 'react';
import { merchizeAPIKey, merchizeBaseURL } from '@/app/shop/product/[id]/productDetailsSSR';

// Resolve USD base price (in cents) for a productId.
// Uses Next fetch cache with revalidate + tags for surgical invalidation.
export const getUSDCentsForProduct = cache(async (productId: string): Promise<number | null> => {
  try {
    const res = await fetch(`${merchizeBaseURL}/product/products/${productId}`, {
      headers: { 'X-API-KEY': merchizeAPIKey },
      next: { revalidate: 6 * 60 * 60, tags: [`product:${productId}`, 'prices:usd'] }, // tune window
    });
    if (!res.ok) return null;
    const json = await res.json();
    const dollars = Number(json?.data?.retail_price);
    if (!Number.isFinite(dollars)) return null;
    return Math.round(dollars * 100);
  } catch {
    return null;
  }
});

export async function getUSDCentsForProducts(
  ids: string[],
): Promise<Record<string, number | null>> {
  const pairs = await Promise.all(
    ids.map(async (id) => [id, await getUSDCentsForProduct(id)] as const),
  );
  return Object.fromEntries(pairs);
}

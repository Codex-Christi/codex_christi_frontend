// src/actions/getCatalogItem.ts
'use server';

import {
  getMultipleSKUsData,
  getVariantSKUCatalogData,
} from '@/lib/datasetSearchers/merchize/catalog';
// import { revalidatePath } from 'next/cache'; // optional

export async function getCatalogItem(sku: string) {
  const item = await getVariantSKUCatalogData(sku);
  return item ?? null;
}

export async function getCatalogItems(skus: string[]) {
  return await getMultipleSKUsData(skus);
}

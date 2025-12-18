// Utility module (no 'use server' here)
import { cache } from 'react';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { RawRow, Row, CatalogItem, Band, DestKey } from './shipping.types';

const DATASET_PATH =
  'src/datasets/merchize/normalized_destination_shipping_by_sku_region_nested_with_extras.json';

// Replace invalid JSON tokens before parsing
function sanitizeJsonText(raw: string) {
  return raw
    .replace(/\b-?Infinity\b/g, 'null')
    .replace(/\bNaN\b/g, 'null')
    .replace(/\bNone\b/g, 'null');
}

export const loadNormalizedRows = cache(async (): Promise<Row[]> => {
  const raw = await readFile(join(process.cwd(), DATASET_PATH), 'utf8');
  const clean = sanitizeJsonText(raw);
  const parsed: unknown = JSON.parse(clean);
  if (!Array.isArray(parsed)) return [];
  return normalizeRows(parsed as RawRow[]);
});

export const getIndexBySku = cache(async () => {
  const rows = await loadNormalizedRows();
  const map = new Map<string, Row>();
  for (const r of rows) map.set(r.sku, r);
  return map;
});

export const loadExtrasBySku = cache(async () => {
  const rows = await loadNormalizedRows();
  const map = new Map<string, Record<string, unknown> | undefined>();
  for (const r of rows) {
    map.set(r.sku, r.extras ?? undefined);
  }
  return map;
});

export function normalizeRows(raw: RawRow[]): Row[] {
  const out: Row[] = [];
  for (const r of raw) {
    if (!r || !r.sku || typeof r.sku !== 'string') continue;
    const s = r.shipping ?? {};
    const shipping: Partial<Record<DestKey, Band>> = {};
    (['US', 'EU', 'GB', 'CA', 'AU', 'ROW'] as const).forEach((k) => {
      const band = s[k];
      if (band && typeof band === 'object') shipping[k] = band;
    });

    const allowed: Row['production_region'][] = ['US', 'VN', 'EU', 'AU', 'GB', 'CA', 'CN'];
    const region = (allowed as readonly string[]).includes(r.production_region as string)
      ? (r.production_region as Row['production_region'])
      : 'US';

    out.push({
      sku: r.sku,
      sku_prefix_all_sheets: r.sku_prefix_all_sheets ?? null,
      product_name: r.product_name ?? null,
      production_region: region,
      shipping,
      extras: r.extras ?? undefined,
    });
  }
  return out;
}

function bandToPair(b?: Band) {
  return { first: b?.first_item ?? null, addl: b?.additional_item ?? null };
}

export function toCatalogItem(row: Row): CatalogItem {
  const US = bandToPair(row.shipping.US);
  const EU = bandToPair(row.shipping.EU);
  const GB = bandToPair(row.shipping.GB);
  const CA = bandToPair(row.shipping.CA);
  const AU = bandToPair(row.shipping.AU);
  const ROW = bandToPair(row.shipping.ROW);

  return {
    SKU_product: null,
    SKU_variant: row.sku,
    tier_1_price: null,
    tier_2_price: null,
    tier_3_price: null,

    US_shipping_fee: US.first,
    US_additional_shipping_fee: US.addl,

    EU_shipping_fee: EU.first,
    EU_additional_shipping_fee: EU.addl,

    GB_shipping_fee: GB.first,
    GB_additional_shipping_fee: GB.addl,

    CA_shipping_fee: CA.first,
    CA_additional_shipping_fee: CA.addl,

    AU_shipping_fee: AU.first,
    AU_additional_shipping_fee: AU.addl,

    ROW_shipping_fee: ROW.first,
    ROW_additional_shipping_fee: ROW.addl,
  };
}

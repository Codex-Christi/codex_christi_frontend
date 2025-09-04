// src/actions/getCatalogItem.ts
'use server';

import { cache } from 'react';
import { AhoCorasick } from '@monyone/aho-corasick';

import { loadNormalizedRows, toCatalogItem } from '@/lib/datasetSearchers/merchize/shipping.data';
import type { Row, DestKey, CatalogItem } from '@/lib/datasetSearchers/merchize/shipping.types';
import { iso3ToDest } from '@/lib/datasetSearchers/merchize/dest-map';

/** Normalize to A-Z0-9 only for robust substring matching */
function norm(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Extract all usable patterns for a row (prefix + sku), normalized */
function patternsFromRow(r: Row): string[] {
  const pool = new Set<string>();
  if (r.sku_prefix_all_sheets) pool.add(norm(r.sku_prefix_all_sheets));
  if (r.sku) pool.add(norm(r.sku));
  // drop too-short/noisy tokens (e.g., "US", "EU")
  return Array.from(pool).filter((p) => p.length >= 4);
}

type Indexed = {
  rows: Row[];
  prefixToRows: Map<string, Row[]>;
  automaton: AhoCorasick; // non-generic API: matchInText() -> { begin, end, keyword }
};

/** Build AC automaton from all rows using patternsFromRow (once, cached) */
const buildIndex = cache(async (): Promise<Indexed> => {
  const rows = await loadNormalizedRows();
  const prefixToRows = new Map<string, Row[]>();
  const keywords: string[] = [];

  for (const r of rows) {
    for (const p of patternsFromRow(r)) {
      if (!prefixToRows.has(p)) prefixToRows.set(p, []);
      prefixToRows.get(p)!.push(r);
      keywords.push(p);
    }
  }

  const automaton = new AhoCorasick(keywords);
  return { rows, prefixToRows, automaton };
});

/** Rank: longest > anchored(start|end) > region pref > has dest band */
function rankCandidates(
  fullText: string,
  dest: DestKey,
  cands: { row: Row; prefix: string; begin: number; end: number }[],
) {
  const REGION_PREF: Row['production_region'][] = ['US', 'VN', 'CN', 'EU', 'GB', 'AU', 'CA'];
  const regionScore = new Map(REGION_PREF.map((r, i) => [r, REGION_PREF.length - i]));
  const anchored = (c: { begin: number; end: number }) =>
    c.begin === 0 || c.end === fullText.length - 1 ? 1 : 0;
  const hasDest = (r: Row) => (r.shipping?.[dest] ? 1 : 0);

  cands.sort((a, b) => {
    const len = b.prefix.length - a.prefix.length;
    if (len) return len;
    const anc = anchored(b) - anchored(a);
    if (anc) return anc;
    const reg =
      (regionScore.get(b.row.production_region) ?? 0) -
      (regionScore.get(a.row.production_region) ?? 0);
    if (reg) return reg;
    const d = hasDest(b.row) - hasDest(a.row);
    if (d) return d;
    return 0;
  });
}

/** Fallback: slow path scan over all rows with smaller min length (>=2) */
function slowScanRows(
  rows: Row[],
  textN: string,
): { row: Row; prefix: string; begin: number; end: number }[] {
  const out: { row: Row; prefix: string; begin: number; end: number }[] = [];
  for (const r of rows) {
    const pats = new Set<string>();
    if (r.sku_prefix_all_sheets) pats.add(norm(r.sku_prefix_all_sheets));
    if (r.sku) pats.add(norm(r.sku));
    for (const p of pats) {
      if (p.length < 2) continue;
      const idx = textN.indexOf(p);
      if (idx >= 0) out.push({ row: r, prefix: p, begin: idx, end: idx + p.length - 1 });
    }
  }
  return out;
}

/** Resolve one full SKU to the best dataset row using substring (prefix) match. */
async function resolveRowForFullSku(
  fullSku: string,
  shipToIso3?: string,
): Promise<Row | undefined> {
  const dest: DestKey = shipToIso3 ? iso3ToDest(shipToIso3) : 'ROW';
  const { rows, prefixToRows, automaton } = await buildIndex();

  const textN = norm(fullSku);

  // Stage 1: fast AC scan (min pattern length = 4)
  const hits = automaton.matchInText(textN); // -> Array<{ begin, end, keyword }>
  let cands: { row: Row; prefix: string; begin: number; end: number }[] = [];
  for (const h of hits) {
    const rs = prefixToRows.get(h.keyword) ?? [];
    for (const r of rs) cands.push({ row: r, prefix: h.keyword, begin: h.begin, end: h.end });
  }

  // Stage 2: fallback slow scan (min length = 2) if nothing matched
  if (cands.length === 0) {
    cands = slowScanRows(rows, textN);
  }

  if (cands.length === 0) return undefined;

  rankCandidates(textN, dest, cands);
  return cands[0]?.row;
}

/** ===== Public API (unchanged signatures) ===== */

// Single: return null if not found
export async function getCatalogItem(sku: string): Promise<CatalogItem | null> {
  const row = await resolveRowForFullSku(sku);
  if (!row) return null;
  const base = toCatalogItem(row);
  return { ...base, SKU_variant: sku, SKU_product: base.SKU_product ?? null };
}

/**
 * Multiple: throws if any SKU cannot be matched.
 * Error shape:
 *   err.code = 'SKU_PREFIX_NO_MATCH'
 *   (err as any).misses: string[]
 */
export async function getCatalogItems(skus: string[], shipToIso3?: string): Promise<CatalogItem[]> {
  const results: CatalogItem[] = [];
  const misses: string[] = [];

  for (const full of skus) {
    const row = await resolveRowForFullSku(full, shipToIso3);
    if (!row) {
      misses.push(full);
      continue;
    }
    const base = toCatalogItem(row);
    results.push({ ...base, SKU_variant: full, SKU_product: base.SKU_product ?? null });
  }

  if (misses.length) {
    class SkuPrefixNoMatchError extends Error {
      code: string;
      misses: string[];
      constructor(message: string, misses: string[]) {
        super(message);
        this.code = 'SKU_PREFIX_NO_MATCH';
        this.misses = misses;
      }
    }

    const err = new SkuPrefixNoMatchError(
      `Unmatched SKUs (${misses.length}): ${misses.join(', ')}`,
      misses,
    );
    throw err;
  }

  return results;
}

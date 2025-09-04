// Substring matcher using @monyone/aho-corasick (non-generic API).
import { AhoCorasick } from '@monyone/aho-corasick';
import { loadNormalizedRows } from './shipping.data';
import type { Row, DestKey } from './shipping.types';
import { cache } from 'react';

const REGION_PREF: Row['production_region'][] = ['US', 'VN', 'CN', 'EU', 'GB', 'AU', 'CA'];

type Indexed = {
  prefixToRows: Map<string, Row[]>;
  automaton: AhoCorasick;
};

export const buildPrefixIndex = cache(async (): Promise<Indexed> => {
  const rows = await loadNormalizedRows();
  const prefixToRows = new Map<string, Row[]>();
  const keywords: string[] = [];

  for (const r of rows) {
    const p = (r.sku_prefix_all_sheets ?? '').trim();
    if (!p) continue;
    const key = p.toUpperCase();
    if (!prefixToRows.has(key)) prefixToRows.set(key, []);
    prefixToRows.get(key)!.push(r);
    keywords.push(key);
  }

  const automaton = new AhoCorasick(keywords);
  return { prefixToRows, automaton };
});

export async function bestRowForSku(fullSku: string, dest: DestKey): Promise<Row | undefined> {
  const { prefixToRows, automaton } = await buildPrefixIndex();
  const text = fullSku.toUpperCase();
  const hits = automaton.matchInText(text); // -> { begin, end, keyword }[]

  if (!hits.length) return undefined;

  type Cand = { row: Row; prefix: string; begin: number; end: number };
  const cands: Cand[] = [];
  for (const h of hits) {
    const rows = prefixToRows.get(h.keyword) ?? [];
    for (const r of rows) cands.push({ row: r, prefix: h.keyword, begin: h.begin, end: h.end });
  }

  const regionScore = new Map(REGION_PREF.map((r, i) => [r, REGION_PREF.length - i]));
  const anchored = (c: Cand) => (c.begin === 0 || c.end === text.length - 1 ? 1 : 0);
  const hasDest = (r: Row) => (r.shipping?.[dest] ? 1 : 0);

  cands.sort((a, b) => {
    const len = b.prefix.length - a.prefix.length;
    if (len) return len;
    const anch = anchored(b) - anchored(a);
    if (anch) return anch;
    const reg =
      (regionScore.get(b.row.production_region) ?? 0) -
      (regionScore.get(a.row.production_region) ?? 0);
    if (reg) return reg;
    const d = hasDest(b.row) - hasDest(a.row);
    if (d) return d;
    return 0;
  });

  return cands[0]?.row;
}

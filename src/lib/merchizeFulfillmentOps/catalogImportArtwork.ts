import 'server-only';

import { fetchStrictLiveStorefrontProduct } from '@/lib/merchizeStorefront/strictLiveProduct';
import { getMerchizeProductArtwork } from './merchizeClient';
import { asRecord } from './merchizeMapper';

const designFieldBySide = {
  front: 'design_front',
  back: 'design_back',
  sleeve: 'design_sleeve',
  hood: 'design_hood',
} as const;

type DesignField = (typeof designFieldBySide)[keyof typeof designFieldBySide];
export type CatalogImportDesignFields = Partial<Record<DesignField, string>>;
type SelectedVariant = { productId: string; variantId: string };
type Artwork = { variantId: string | null; record: Record<string, unknown> };

const MIN_SOURCE_LIFETIME_MS = 5 * 60_000;
const MAX_ARTWORK_ROWS = 100;
const ARTWORK_LOOKUP_CONCURRENCY = 4;

export class CatalogImportArtworkError extends Error {}

function unavailable(message: string): never {
  throw new CatalogImportArtworkError(message);
}

function readArtworkVariant(row: Record<string, unknown>): string | null {
  const variant = asRecord(row.variant)?._id ?? row.variant;
  const ids = [row.variant_id, variant].filter((value) => value != null);
  if (
    ids.some((value) => typeof value !== 'string' || !value.trim()) ||
    new Set(ids).size > 1 ||
    (row.variants !== undefined && (!Array.isArray(row.variants) || row.variants.length > 0))
  ) {
    return unavailable('Merchize returned an artwork assignment that cannot be matched to a variant.');
  }
  return (ids[0] as string | undefined) ?? null;
}

function verifyArtworkSource(source: unknown, productId: string, now: number) {
  if (typeof source !== 'string') {
    return unavailable('Merchize did not return a full-size artwork URL.');
  }
  const url = URL.canParse(source) ? new URL(source) : null;
  const expiresAt = Number(url?.searchParams.get('Expires')) * 1000;
  if (
    !url ||
    url.origin !== 'https://merchize-artworks.s3.us-west-1.amazonaws.com' ||
    url.username ||
    url.password ||
    url.hash ||
    !url.pathname.includes(`/artworks/${encodeURIComponent(productId)}/`) ||
    !/\.(png|jpe?g)$/i.test(url.pathname) ||
    !url.searchParams.get('Signature') ||
    !Number.isFinite(expiresAt) ||
    expiresAt - now < MIN_SOURCE_LIFETIME_MS
  ) {
    return unavailable('Merchize did not return a verified, current artwork URL.');
  }
  // Preserve the provider signature exactly as returned.
  return source;
}

async function readProductArtwork(productId: string) {
  const result = await getMerchizeProductArtwork(productId).catch(() =>
    unavailable('Could not read the product artwork from Merchize. No order was imported.'),
  );
  const envelope = asRecord(result);
  const data = asRecord(envelope?.data);
  const rows = data?.artworks;
  if (
    envelope?.success !== true ||
    !Array.isArray(rows) ||
    rows.length !== data?.total ||
    rows.length > MAX_ARTWORK_ROWS
  ) {
    return unavailable('Merchize did not return a complete product artwork list.');
  }
  return rows.flatMap((value): Artwork[] => {
    const row = asRecord(value);
    if (!row || row.product !== productId) {
      return unavailable('Merchize returned artwork that does not match the checkout product.');
    }
    if (row.is_deleted === true) return [];
    return [{ variantId: readArtworkVariant(row), record: row }];
  });
}

/** Read one list per product and decide once per selected variant, in checkout line order. */
export async function resolveCatalogImportArtwork(
  lines: readonly SelectedVariant[],
): Promise<CatalogImportDesignFields[]> {
  const products = [...new Set(lines.map((line) => line.productId))];
  const artworkByProduct = new Map<string, Artwork[]>();
  for (let index = 0; index < products.length; index += ARTWORK_LOOKUP_CONCURRENCY) {
    const batch = products.slice(index, index + ARTWORK_LOOKUP_CONCURRENCY);
    const lists = await Promise.all(batch.map(readProductArtwork));
    batch.forEach((productId, offset) => artworkByProduct.set(productId, lists[offset]));
  }

  const exemptions = new Map<string, Promise<boolean>>();
  const now = Date.now();
  async function decideVariantArtwork({ productId, variantId }: SelectedVariant) {
    const candidates = (artworkByProduct.get(productId) ?? []).filter(
      (artwork) => artwork.variantId === null || artwork.variantId === variantId,
    );
    if (candidates.some(({ record }) => typeof record.side !== 'string' ||
      !Object.hasOwn(designFieldBySide, record.side))) {
      return unavailable('Merchize returned artwork for an unsupported print side.');
    }
    const fields: CatalogImportDesignFields = {};
    for (const [side, field] of Object.entries(designFieldBySide)) {
      const matches = candidates.filter(({ record }) => record.side === side);
      const variantMatches = matches.filter((candidate) => candidate.variantId === variantId);
      const chosen = variantMatches.length
        ? variantMatches
        : matches.filter((candidate) => candidate.variantId === null);
      if (chosen.length > 1) return unavailable('More than one artwork matches the same print side.');
      if (chosen.length === 1) {
        const { record } = chosen[0];
        if (record.is_uploaded !== true || record.is_deleted !== false) {
          return unavailable('A matching Merchize artwork is not available for print.');
        }
        fields[field] = verifyArtworkSource(record.origin_url, productId, now);
      }
    }
    if (Object.keys(fields).length) return fields;

    let exemption = exemptions.get(productId);
    if (!exemption) {
      exemption = fetchStrictLiveStorefrontProduct(productId)
        .then((product) => product._id === productId && product.no_need_artworks === true)
        .catch(() => false);
      exemptions.set(productId, exemption);
    }
    if (await exemption) return fields;
    return unavailable('No verified artwork matches the selected Merchize variant.');
  }

  const decisions = new Map<string, Promise<CatalogImportDesignFields>>();
  return Promise.all(lines.map((line) => {
    const key = JSON.stringify([line.productId, line.variantId]);
    let decision = decisions.get(key);
    if (!decision) {
      decision = decideVariantArtwork(line);
      decisions.set(key, decision);
    }
    return decision;
  }));
}

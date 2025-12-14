'use server';

import { ProductOption, ProductVariantsInterface } from '@/app/shop/product/[id]/productDetailsSSR';
import { FetcherOptions, universalFetcher } from '@/lib/utils/SWRfetcherAdvanced';
import didYouMean, { ThresholdTypeEnums } from 'didyoumean2';

interface ProductLineAvailResp {
  success: boolean;
  data: {
    presets: Array<{
      _id: string;
      sku: string;
      variants: Array<{
        _id: string;
        sku: string;
        currency: string;
        base_cost: {
          DTF: number;
          DTG: number;
        };
        options: Array<{
          attribute_type: string;
          name?: string;
          value?: string;
        }>;
      }>;
    }>;
  };
}

type VariantKey = {
  size?: string;
  color?: string;
};

type LinePreset = ProductLineAvailResp['data']['presets'][number];
type LineVariant = LinePreset['variants'][number];

type VariantsRespVariant = ProductVariantsInterface['data'][number];

// Tiny spelling drift detector (missing/extra letter / small typo). Returns distance if <= max.
const distAtMost = (a: string, b: string, max = 2): number | null => {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return null;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = i;

    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }

    if (rowMin > max) return null;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }

  return prev[b.length] <= max ? prev[b.length] : null;
};

const suggestLineVariantByColorDrift = (presets: LinePreset[], target: VariantKey) => {
  if (!target.size || !target.color) return undefined;

  // same-size only; keep first hit per color
  const byColor = new Map<string, { preset: LinePreset; variant: LineVariant; key: VariantKey }>();

  for (const preset of presets) {
    for (const variant of preset.variants ?? []) {
      const key = getKeyFromLineVariant(variant);
      if (key.size !== target.size || !key.color) continue;
      if (!byColor.has(key.color)) byColor.set(key.color, { preset, variant, key });
    }
  }

  if (!byColor.size) return undefined;

  const colors = [...byColor.keys()];
  const closest = didYouMean(target.color, colors, {
    threshold: 0.75,
    thresholdType: ThresholdTypeEnums.SIMILARITY,
  }) as string | null;

  if (!closest || closest === target.color) return undefined;

  const dist = distAtMost(target.color, closest, 2);
  if (dist === null) return undefined;

  const hit = byColor.get(closest);
  if (!hit) return undefined;

  return {
    presetId: hit.preset._id,
    presetSku: hit.preset.sku,
    variantId: hit.variant._id,
    lineSku: hit.variant.sku,
    lineVariant: hit.variant,
    lineKey: hit.key,
    distance: dist,
    score: 1 - dist / (Math.max(target.color.length, closest.length) || 1),
  };
};

const normalizeToken = (input?: string | null) =>
  (input ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, '')
    .replace(/[^a-z0-9]/g, '');

const getKeyFromVariantsResp = (variant: VariantsRespVariant): VariantKey => {
  const opts = (
    Array.isArray(variant?.options) ? variant.options : []
  ) as VariantsRespVariant['options'];

  const sizeOpt = opts.find(
    (o) => o?.attribute?.value_type === 'size' || o?.attribute?.name?.toLowerCase?.() === 'size',
  );

  const colorOpt = opts.find(
    (o) => o?.attribute?.value_type === 'color' || o?.attribute?.name?.toLowerCase?.() === 'color',
  );

  const size = normalizeToken(sizeOpt?.slug ?? sizeOpt?.value ?? sizeOpt?.name);
  const color = normalizeToken(colorOpt?.slug ?? colorOpt?.name);

  return {
    size: size || undefined,
    color: color || undefined,
  };
};

const getKeyFromLineVariant = (lineVariant: LineVariant): VariantKey => {
  const opts = (
    Array.isArray(lineVariant?.options) ? lineVariant.options : []
  ) as LineVariant['options'];

  const sizeOpt = opts.find((o) => o?.attribute_type === 'size');
  const colorOpt = opts.find((o) => o?.attribute_type === 'color');

  const size = normalizeToken(sizeOpt?.value ?? sizeOpt?.name);
  const color = normalizeToken(colorOpt?.value ?? colorOpt?.name);

  return {
    size: size || undefined,
    color: color || undefined,
  };
};

const toKey = (k: VariantKey) => (k.size && k.color ? `${k.color}|${k.size}` : '');

type LineHit = {
  presetId: string;
  presetSku: string;
  variantId: string;
  lineSku: string;
  lineVariant: LineVariant;
  lineKey: VariantKey;
};

export const checkProductLineAvail = async ({
  matchingVariantLineProductOption,
  matchingVariant,
}: {
  matchingVariantLineProductOption: ProductOption;
  matchingVariant: ProductVariantsInterface['data'][number];
}) => {
  try {
    const checkLineRes = await universalFetcher<
      ProductLineAvailResp,
      { title: string; store_slug: string; source_screen: string }
    >('https://seller.merchize.com/api/product-line/catalog-products/preset/v2/search', {
      arg: {
        title: matchingVariantLineProductOption.name,
        store_slug: '27mkjsl',
        source_screen: 'order-detail',
      }, // <- becomes JSON body (POST by default in your fetcher)
      fetcherOptions: {
        // You can override anything here if needed:
        method: 'POST', // your fetcher auto-POSTs when arg is present—this is optional
        headers: {
          'X-Store-id': '27mkjsl',
          'X-API-KEY': process.env.MERCHIZE_API_KEY ?? '',
          'Content-Type': 'application/json',
        },
        next: {
          revalidate: 1 * 60 * 60,
          tags: [`prodLine-${matchingVariantLineProductOption.name}`],
        }, // tune window
        // cache: 'no-store', // if you want to force no caching on server
      } as FetcherOptions,
    });

    // Build the deterministic matching key from the user's selected variant (variants-resp.json shape)
    const targetKey = getKeyFromVariantsResp(matchingVariant);

    // Collect all candidate line variants from the line search response
    const presets: LinePreset[] = Array.isArray(checkLineRes?.data?.presets)
      ? checkLineRes.data.presets
      : [];

    const lineIndex = new Map<string, LineHit>();

    for (const preset of presets) {
      for (const variant of preset.variants ?? []) {
        const lineKey = getKeyFromLineVariant(variant);
        const k = toKey(lineKey);
        if (!k) continue;
        lineIndex.set(k, {
          presetId: preset._id,
          presetSku: preset.sku,
          variantId: variant._id,
          lineSku: variant.sku,
          lineVariant: variant,
          lineKey,
        });
      }
    }

    const found = lineIndex.get(toKey(targetKey));
    const isAvailable = !!found;

    // If exact match fails, try to *suggest* a likely match (spelling drift) without auto-picking it.
    // This helps you detect drift early and avoid silent "variant not found" later.
    const driftSuggestion = !isAvailable
      ? suggestLineVariantByColorDrift(presets, targetKey)
      : undefined;

    // Minimal but useful log: one line summary for debugging
    console.log(
      `[checkProductLineAvail] ${matchingVariant?.sku ?? 'unknown-variant'} key=${toKey(targetKey) || '??'} -> ${
        isAvailable
          ? `FOUND lineSku=${found!.lineSku}`
          : driftSuggestion
            ? `NOT_FOUND (closest lineSku=${driftSuggestion.lineSku} dist=${driftSuggestion.distance})`
            : 'NOT_FOUND'
      }`,
    );

    // When not found, return enough info so caller can surface a warning + you can audit naming drift later
    return {
      ok: true as const,
      isAvailable,
      target: {
        sku: matchingVariant?.sku,
        key: targetKey,
        title: matchingVariant?.title,
        productId: matchingVariant?.product,
      },
      line: isAvailable
        ? {
            presetId: found!.presetId,
            presetSku: found!.presetSku,
            variantId: found!.variantId,
            sku: found!.lineSku,
            key: found!.lineKey,
            currency: found!.lineVariant.currency,
            base_cost: found!.lineVariant.base_cost,
          }
        : null,
      // Handy hint: if this was caused by naming drift, you'll often see target has size/color but no line match.
      debug: isAvailable
        ? null
        : {
            searchedTitle: matchingVariantLineProductOption?.name,
            presetsReturned: presets.length,
            note: 'No exact (color,size) match found in line variants. A drift suggestion may appear if the color is a close spelling match. If this becomes frequent, review your vendor naming, normalization, or thresholds.',
          },
      drift:
        !isAvailable && driftSuggestion
          ? {
              kind: 'color_spelling' as const,
              note: 'Exact (color,size) match not found. A close color match exists for the same size (likely spelling drift). Review before using.',
              targetKey,
              suggested: {
                presetId: driftSuggestion.presetId,
                presetSku: driftSuggestion.presetSku,
                variantId: driftSuggestion.variantId,
                sku: driftSuggestion.lineSku,
                key: driftSuggestion.lineKey,
                distance: driftSuggestion.distance,
                confidence: driftSuggestion.score,
              },
            }
          : null,
    };
  } catch (err) {
    console.error('[checkProductLineAvail] error', err);
    return {
      ok: false as const,
      isAvailable: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
};

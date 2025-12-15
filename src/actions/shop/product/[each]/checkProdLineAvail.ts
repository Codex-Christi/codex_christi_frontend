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

type DriftResult = {
  suggested: {
    key: VariantKey;
  };
};

type LineCheckResult =
  | {
      ok: true;
      isAvailable: boolean;
      drift: DriftResult | null;
    }
  | {
      ok: false;
      isAvailable: false;
      drift: null;
    };

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
      const v = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return null;
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length] <= max ? prev[b.length] : null;
};

const normalizeToken = (input?: string | null) =>
  (input ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, '')
    .replace(/[^a-z0-9]/g, '');

const getKeyFromVariantsResp = (variant: VariantsRespVariant): VariantKey => {
  const opts = variant.options ?? [];
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
  const opts = lineVariant.options ?? [];
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
  lineSku: string;
  lineKey: VariantKey;
};
type DriftSuggestion = LineHit & { distance: number; score: number };

export const checkProductLineAvail = async ({
  matchingVariantLineProductOption,
  matchingVariant,
}: {
  matchingVariantLineProductOption: ProductOption;
  matchingVariant: ProductVariantsInterface['data'][number];
}): Promise<LineCheckResult> => {
  try {
    const checkLineRes = await universalFetcher<
      ProductLineAvailResp,
      { title: string; store_slug: string; source_screen: string }
    >('https://seller.merchize.com/api/product-line/catalog-products/preset/v2/search', {
      arg: {
        title: matchingVariantLineProductOption.name,
        store_slug: '27mkjsl',
        source_screen: 'order-detail',
      },
      fetcherOptions: {
        headers: {
          'X-Store-id': '27mkjsl',
          'X-API-KEY': process.env.MERCHIZE_API_KEY ?? '',
          'Content-Type': 'application/json',
        },
        next: {
          revalidate: 60 * 60,
          tags: [`prodLine-${matchingVariantLineProductOption.name}`],
        },
      } as FetcherOptions,
    });

    // Build the deterministic matching key from the user's selected variant (variants-resp.json shape)
    const targetKey = getKeyFromVariantsResp(matchingVariant);

    // Collect all candidate line variants from the line search response
    const presets: LinePreset[] = Array.isArray(checkLineRes?.data?.presets)
      ? checkLineRes.data.presets
      : [];

    const targetK = toKey(targetKey);

    // One pass: (1) locate exact match, (2) collect same-size colors for optional drift suggestion
    let found: LineHit | undefined;
    const sameSizeByColor = new Map<string, LineHit>();

    for (const preset of presets) {
      for (const variant of preset.variants ?? []) {
        const lineKey = getKeyFromLineVariant(variant);
        const k = toKey(lineKey);
        if (!k) continue;

        const hit: LineHit = {
          lineSku: variant.sku ?? 'unknown-sku',
          lineKey,
        };

        // Match semantics: same as Map overwrite (last match wins if duplicates exist)
        if (k === targetK) found = hit;

        // Drift candidates: same size only; keep first hit per color
        if (
          targetKey.size &&
          lineKey.size === targetKey.size &&
          lineKey.color &&
          !sameSizeByColor.has(lineKey.color)
        ) {
          sameSizeByColor.set(lineKey.color, hit);
        }
      }
    }

    const isAvailable = !!found;

    let driftSuggestion: DriftSuggestion | undefined;
    if (!isAvailable && targetKey.color && targetKey.size && sameSizeByColor.size) {
      const colors = [...sameSizeByColor.keys()];
      const closest = didYouMean(targetKey.color, colors, {
        threshold: 0.75,
        thresholdType: ThresholdTypeEnums.SIMILARITY,
      }) as string | null;

      if (closest && closest !== targetKey.color) {
        const dist = distAtMost(targetKey.color, closest, 2);
        const hit = dist === null ? undefined : sameSizeByColor.get(closest);
        if (dist !== null && hit) {
          driftSuggestion = {
            ...hit,
            distance: dist,
            score: 1 - dist / (Math.max(targetKey.color.length, closest.length) || 1),
          };
        }
      }
    }

    // Minimal but useful log: one line summary for debugging
    console.log(
      `[checkProductLineAvail] ${matchingVariant?.sku ?? 'unknown-variant'} key=${toKey(targetKey) || '??'} -> ${
        isAvailable
          ? `FOUND lineSku=${found?.lineSku}`
          : driftSuggestion
            ? `NOT_FOUND (closest lineSku=${driftSuggestion.lineSku} dist=${driftSuggestion.distance})`
            : 'NOT_FOUND'
      }`,
    );

    const drift =
      !isAvailable && driftSuggestion
        ? {
            suggested: {
              key: driftSuggestion.lineKey,
            },
          }
        : null;

    return {
      ok: true as const,
      isAvailable,
      drift,
    };
  } catch (err) {
    console.error('[checkProductLineAvail] error verifying production line availability', err);
    return {
      ok: false as const,
      isAvailable: false,
      drift: null,
    };
  }
};

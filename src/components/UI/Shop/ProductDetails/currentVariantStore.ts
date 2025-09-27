import {
  ProductVariantsInterface,
  ColorAttribute,
  SizeAttribute,
  hasColorAndSize,
} from '@/app/shop/product/[id]/productDetailsSSR';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';

// 🧠 Types
type Variant = ProductVariantsInterface['data'][0];
type Variants = ProductVariantsInterface['data'];

interface CurrentVariantStore {
  matchingVariant: Variant | null;
  setMatchingVariant: (variant: Variant | null) => void;

  // Tuple: [ProductAttribute (unused), Size, Color]
  currentVariantOptions: [null, SizeAttribute | null, ColorAttribute | null];
  setColor: (color: ColorAttribute) => void;
  setSize: (size: SizeAttribute, variant: Variant) => void;
  resetVariantOptions: () => void;

  findMatchingVariant: (variants: Variants) => Variant | undefined;
}

// Helper: find indices by attribute name (case-insensitive)
function getOptionIndices(options: Variant['options']) {
  let sizeIdx: number | null = null;
  let colorIdx: number | null = null;

  options?.forEach((opt, idx) => {
    const n = opt?.attribute?.name?.toLowerCase();
    if (n === 'size') sizeIdx = idx;
    if (n === 'color') colorIdx = idx;
  });

  return { sizeIdx, colorIdx };
}

export const useCurrentVariant = create<CurrentVariantStore>()(
  subscribeWithSelector<CurrentVariantStore>((set, get) => ({
    matchingVariant: null,
    currentVariantOptions: [null, null, null],

    setMatchingVariant: (variant) =>
      set((s) => (s.matchingVariant === variant ? s : { matchingVariant: variant })),

    setColor: (color) =>
      set((state) => ({
        currentVariantOptions: [null, state.currentVariantOptions[1], color],
      })),

    setSize: (size, variant) => {
      const hasBoth = hasColorAndSize(variant.options);
      return set((state) => ({
        currentVariantOptions: [null, size, hasBoth ? state.currentVariantOptions[2] : null],
      }));
    },

    resetVariantOptions: () =>
      set({ currentVariantOptions: [null, null, null], matchingVariant: null }),

    findMatchingVariant: (variants) => {
      if (!Array.isArray(variants) || variants.length === 0) {
        console.error('Invalid variants passed to findMatchingVariant');
        get().setMatchingVariant(null);
        return undefined;
      }

      const [, selSize, selColor] = get().currentVariantOptions;

      // Determine indices from the first variant’s option schema
      const { sizeIdx, colorIdx } = getOptionIndices(variants[0]?.options ?? []);

      const eq = (a?: string, b?: string) => (a ?? '').toLowerCase() === (b ?? '').toLowerCase();

      const matched = variants.find((variant) => {
        const sizeVal = sizeIdx != null ? variant?.options?.[sizeIdx]?.value : undefined;
        const colorVal = colorIdx != null ? variant?.options?.[colorIdx]?.value : undefined;

        if (selSize && selColor) return eq(sizeVal, selSize.value) && eq(colorVal, selColor.value);
        if (selSize) return eq(sizeVal, selSize.value);
        if (selColor) return eq(colorVal, selColor.value);
        return false; // nothing selected → no match (don’t force first variant)
      });

      get().setMatchingVariant(matched ?? null);
      return matched;
    },
  })),
);

// 🔄 Auto-match when options change (with shallow equality to prevent noisy triggers)
export function setupVariantAutoMatching(variants: Variants) {
  if (!Array.isArray(variants) || variants.length === 0) {
    console.error('Invalid variants passed to setupVariantAutoMatching');
    return () => {};
  }

  return useCurrentVariant.subscribe(
    (s) => s.currentVariantOptions,
    () => {
      useCurrentVariant.getState().findMatchingVariant(variants);
    },
    { equalityFn: shallow }, // <— only fire when tuple actually changes top-level
  );
}

// Optional: keep a dev log when the matched variant changes (fireImmediately true if you want)
// useCurrentVariant.subscribe(
//   (s) => s.matchingVariant,
//   (mv) => {
//     // no-op now; useful for debugging:
//     // console.debug('[matchingVariant]', mv?._id);
//   },
//   // { fireImmediately: true }
// );

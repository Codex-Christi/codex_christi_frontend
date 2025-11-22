import {
  ProductVariantsInterface,
  ColorAttribute,
  SizeAttribute,
  LabelAttribute,
} from '@/app/shop/product/[id]/productDetailsSSR';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';

// 🧠 Types
type Variant = ProductVariantsInterface['data'][0];
type Variants = ProductVariantsInterface['data'];

// keep the raw option type around for label setters etc.
type VariantSelectionState = Record<string, string | null>;

interface CurrentVariantStore {
  matchingVariant: Variant | null;
  setMatchingVariant: (variant: Variant | null) => void;

  // currentVariantOptions is keyed by normalized attribute name (e.g. 'size', 'color', 'label')
  currentVariantOptions: VariantSelectionState;
  setColor: (color: ColorAttribute | null, variant?: Variant) => void;
  setSize: (size: SizeAttribute | null, variant?: Variant) => void;
  setLabel: (label: LabelAttribute | null, variant?: Variant) => void;
  resetVariantOptions: () => void;

  findMatchingVariant: (variants: Variants) => Variant | undefined;
}

// Helpers
const normalizeAttrName = (name?: string | null): string => (name ?? '').trim().toLowerCase();

type WithOptionalValue = { value?: string | number | null };

const extractValue = (option: WithOptionalValue | null | undefined): string | null => {
  if (!option) return null;
  const raw = option.value;
  if (raw === undefined || raw === null) return null;
  return String(raw);
};

const buildVariantValueMap = (variant: Variant): Record<string, string | undefined> => {
  const map: Record<string, string | undefined> = {};

  variant?.options?.forEach((opt) => {
    const key = normalizeAttrName(opt?.attribute?.name);
    const value = opt?.value;
    if (key) {
      map[key] = value;
    }
  });

  return map;
};

export const useCurrentVariant = create<CurrentVariantStore>()(
  subscribeWithSelector((set, get) => ({
    matchingVariant: null,

    // initialise known keys, but store is flexible enough to accept others as needed
    currentVariantOptions: {
      size: null,
      color: null,
      label: null,
    },

    setMatchingVariant: (variant: Variant | null) =>
      set((s) => (s.matchingVariant === variant ? s : { ...s, matchingVariant: variant })),

    // Note: `variant` parameter is optional and currently unused, but kept for backwards compatibility
    setColor: (color: ColorAttribute | null) =>
      set((state) => ({
        currentVariantOptions: {
          ...state.currentVariantOptions,
          color: extractValue(color as unknown as WithOptionalValue),
        },
      })),

    setSize: (size: SizeAttribute | null) =>
      set((state) => ({
        currentVariantOptions: {
          ...state.currentVariantOptions,
          size: extractValue(size as unknown as WithOptionalValue),
        },
      })),

    setLabel: (label: LabelAttribute | null) =>
      set((state) => ({
        currentVariantOptions: {
          ...state.currentVariantOptions,
          label: extractValue(label as unknown as WithOptionalValue),
        },
      })),

    resetVariantOptions: () =>
      set({
        currentVariantOptions: {
          size: null,
          color: null,
          label: null,
        },
        matchingVariant: null,
      }),

    findMatchingVariant: (variants: Variants) => {
      if (!Array.isArray(variants) || variants.length === 0) {
        console.error('Invalid variants passed to findMatchingVariant');
        set((s) => ({ ...s, matchingVariant: null }));
        return undefined;
      }

      const selections = get().currentVariantOptions;

      // Only use attributes that actually have a non-empty selection
      const activeKeys = Object.entries(selections)
        .filter(([, v]) => v !== null && v !== '')
        .map(([k]) => k);

      if (activeKeys.length === 0) {
        set((s) => ({ ...s, matchingVariant: null }));
        return undefined;
      }

      const matched = variants.find((variant) => {
        const map = buildVariantValueMap(variant);

        return activeKeys.every((attrName) => {
          const selected = selections[attrName];
          if (!selected) return false;

          const variantVal = map[attrName];
          return (variantVal ?? '').toLowerCase() === selected.toLowerCase();
        });
      });

      set((s) => ({ ...s, matchingVariant: matched ?? null }));
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

  // Determine which attributes are actually used to describe variants for this product.
  // We treat these as the "required" selection set before we attempt a match.
  const requiredAttributes = new Set<string>();

  const firstVariant = variants[0];
  firstVariant?.options?.forEach((opt) => {
    const name = normalizeAttrName(opt?.attribute?.name);
    if (name) requiredAttributes.add(name);
  });

  return useCurrentVariant.subscribe(
    (s) => s.currentVariantOptions,
    (currentOptions) => {
      const activeKeys = Object.entries(currentOptions)
        .filter(([, v]) => v !== null && v !== '')
        .map(([k]) => k);

      const hasAllRequired = Array.from(requiredAttributes).every((attr) => {
        const v = currentOptions[attr];
        return typeof v === 'string' && v.length > 0;
      });

      const state = useCurrentVariant.getState();

      // If no active selection or not all required attributes are selected yet,
      // we do not attempt a match and clear any previous match.
      if (!hasAllRequired || activeKeys.length === 0) {
        if (state.matchingVariant !== null) {
          state.setMatchingVariant(null);
        }
        return;
      }

      state.findMatchingVariant(variants);
    },
    { equalityFn: shallow },
  );
}

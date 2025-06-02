import {
  ProductVariantsInterface,
  ColorAttribute,
  SizeAttribute,
  hasColorAndSize,
} from '@/app/shop/product/[id]/productDetailsSSR';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// 🧠 Types
interface CurrentVariantStore {
  matchingVariant: ProductVariantsInterface['data'][0] | null;
  setMatchingVariant: (
    variant: ProductVariantsInterface['data'][0] | null
  ) => void;
  currentVariantOptions: [null, SizeAttribute | null, ColorAttribute | null];
  setColor: (color: ColorAttribute) => void;
  setSize: (
    size: SizeAttribute,
    variant: ProductVariantsInterface['data'][0]
  ) => void;
  resetVariantOptions: () => void;
  findMatchingVariant: (
    variants: ProductVariantsInterface['data']
  ) => ProductVariantsInterface['data'][0] | undefined;
}

// 🏪 Zustand store
export const useCurrentVariant = create<CurrentVariantStore>()(
  subscribeWithSelector<CurrentVariantStore>((set, get) => ({
    matchingVariant: null,
    currentVariantOptions: [null, null, null],

    setMatchingVariant: (variant) => set({ matchingVariant: variant }),

    setColor: (color) =>
      set((state) => ({
        currentVariantOptions: [null, state.currentVariantOptions[1], color],
      })),

    setSize: (size, variant) => {
      const hasSizeOnly = !hasColorAndSize(variant.options);

      return set((state) => ({
        currentVariantOptions: [
          null,
          size,
          hasSizeOnly ? null : state.currentVariantOptions[2],
        ],
      }));
    },

    resetVariantOptions: () =>
      set({ currentVariantOptions: [null, null, null] }),

    findMatchingVariant: (variants) => {
      // Add null/undefined check for variants
      if (!variants || !Array.isArray(variants)) {
        console.error('Invalid variants passed to findMatchingVariant');
        return undefined;
      }

      const [, size, color] = get().currentVariantOptions;

      const matchedProductVariant = variants.find((variant) => {
        const [, variantSize, variantColor] =
          variant.options.length > 2 // Check if options have size and color
            ? variant.options
            : [null, variant.options[0], null]; // Fallback for size only

        // Case 1: Both size and color selected
        if (size && color) {
          return (
            variantSize?.value === size.value &&
            variantColor?.value === color.value
          );
        }

        // Case 2: Only size selected
        if (size && !color) {
          return variantSize?.value.toLowerCase() === size.value.toLowerCase();
        }

        // Case 3: Only color selected
        if (color) {
          return variantColor?.value === color.value;
        }

        // Default: No selection - return first variant
        return variant === variants[0];
      });

      get().setMatchingVariant(matchedProductVariant ?? null);
      return matchedProductVariant;
    },
  }))
);

// 🔄 Subscription to auto-trigger matching when options change
export function setupVariantAutoMatching(
  variants: ProductVariantsInterface['data']
) {
  // Validate variants before setting up subscription
  if (!variants || !Array.isArray(variants)) {
    console.error('Invalid variants passed to setupVariantAutoMatching');
    return () => {}; // Return empty unsubscribe function
  }

  return useCurrentVariant.subscribe(
    (state) => state.currentVariantOptions,
    () => {
      useCurrentVariant.getState().findMatchingVariant(variants);
    }
  );
}

// 🔍 Subscription to log matching variant changes
useCurrentVariant.subscribe(
  (state) => state.matchingVariant,
  (newMatch) => {
    console.log('[Matching Variant Changed]', newMatch);
  }
);

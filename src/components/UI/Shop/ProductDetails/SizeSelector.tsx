'use client';

import RadioButtonGroup from './RadioButtonGroupWithText';
import { OptionalProductVariantProps, ProductDetailsContext } from '.';
import {
  ColorAttribute,
  hasColorAndSize,
  ProductAttribute,
  SizeAttribute,
} from '@/app/shop/product/[id]/productDetailsSSR';
import { FC, use, useCallback, useEffect, useMemo } from 'react';
import { useCurrentVariant } from './currentVariantStore';

// Keep this outside the component
const sizeFormatArr = ['xs', 's', 'm', 'l', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'];

function isSizeAttribute(
  option: SizeAttribute | ColorAttribute | ProductAttribute | undefined,
): option is SizeAttribute {
  const name = option?.attribute?.name;
  return typeof name === 'string' && name.toLowerCase() === 'size';
}

const SizeSelector: FC<OptionalProductVariantProps> = ({ variants }) => {
  // -------------------- ALWAYS TOP-LEVEL HOOK CALLS --------------------
  // 1) Context read (safe even without a Provider; value may be undefined)
  const ctx = use(ProductDetailsContext);

  // 2) Zustand hook — **MUST NOT** be conditional
  const setSize = useCurrentVariant((s) => s.setSize);
  const resetVariantOptions = useCurrentVariant((s) => s.resetVariantOptions);
  // ---------------------------------------------------------------------

  // Prefer props, fall back to context value. This branching is on **values**, not on hooks.
  const productVariants = useMemo(
    () => variants ?? ctx?.productVariants ?? [],
    [ctx?.productVariants, variants],
  );

  const productHasColorAndSize = hasColorAndSize(productVariants[0]!.options);

  const onChangeSize = useCallback(
    (value: string | { name: string; value: string }) => {
      const sizeValue = (typeof value === 'string' ? value : value?.value)?.toLowerCase();

      if (!sizeValue) return;

      const index = productHasColorAndSize ? 1 : 0;
      const matched = productVariants.find(
        (variant) => variant?.options?.[index]?.value?.toLowerCase() === sizeValue,
      );

      const sizeOption = matched?.options?.[index];

      if (isSizeAttribute(sizeOption) && matched) {
        setSize(sizeOption, matched);
      } else {
        console.warn('[SizeSelector:onChangeSize] Not a valid SizeAttribute:', sizeOption);
      }
    },
    [productHasColorAndSize, productVariants, setSize],
  );

  const uniqueSizesOptions = useMemo(() => {
    const sizesRaw = productVariants
      .map((variant) => {
        const idx = productHasColorAndSize ? 1 : 0;
        const v = variant?.options?.[idx]?.value;
        return v ? v.toString().toUpperCase() : undefined;
      })
      .filter(Boolean) as string[];

    const deduped = Array.from(new Set(sizesRaw));
    const sorted = productHasColorAndSize
      ? [...deduped].sort(
          (a, b) => sizeFormatArr.indexOf(a.toLowerCase()) - sizeFormatArr.indexOf(b.toLowerCase()),
        )
      : deduped;

    return sorted.map((size) => ({
      value: size,
      label: size,
      key: `size-${size.toLowerCase()}`,
    }));
  }, [productHasColorAndSize, productVariants]);

  // Use Effects
  // Reset Current variants on mount
  useEffect(() => {
    resetVariantOptions();
  }, [resetVariantOptions]);

  if (uniqueSizesOptions.length === 0) return null;

  // Main JSX
  return (
    <section className='!space-y-6 pb-6'>
      <div className='space-y-1'>
        <h3 className='text-xl'>Sizes:</h3>
        <RadioButtonGroup props={uniqueSizesOptions} onChange={onChangeSize} />
      </div>
    </section>
  );
};

export default SizeSelector;

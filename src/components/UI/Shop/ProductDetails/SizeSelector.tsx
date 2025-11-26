'use client';

import RadioButtonGroup from './RadioButtonGroupWithText';
import { SizeAttribute } from '@/app/shop/product/[id]/productDetailsSSR';
import { FC, useCallback, useEffect, useMemo } from 'react';
import { useCurrentVariant } from './currentVariantStore';

// Keep this outside the component
export const sizeFormatArr = ['xs', 's', 'm', 'l', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'];

const SizeSelector: FC<{ sizeOptionsList: SizeAttribute[] }> = ({ sizeOptionsList }) => {
  // -------------------- ALWAYS TOP-LEVEL HOOK CALLS --------------------
  // 2) Zustand hook — **MUST NOT** be conditional
  const setSize = useCurrentVariant((s) => s.setSize);
  const resetVariantOptions = useCurrentVariant((s) => s.resetVariantOptions);
  // ---------------------------------------------------------------------

  const onChangeSize = useCallback(
    (value: string | { name: string; value: string }) => {
      const raw = typeof value === 'string' ? value : value?.value;
      if (!raw) return;

      const normalized = raw.toLowerCase();

      // Find the matching SizeAttribute from the list we were given.
      const matched = sizeOptionsList.find((opt) => opt.value.toLowerCase() === normalized);

      if (!matched) {
        console.warn('[SizeSelector:onChangeSize] No SizeAttribute matched for value:', value);
        return;
      }

      setSize(matched);
    },
    [sizeOptionsList, setSize],
  );

  const uniqueSizesOptions = useMemo(() => {
    const sizesRaw = sizeOptionsList.map((s) => s.value);

    const deduped = Array.from(new Set(sizesRaw));
    const sorted = [...deduped].sort(
      (a, b) => sizeFormatArr.indexOf(a.toLowerCase()) - sizeFormatArr.indexOf(b.toLowerCase()),
    );

    return sorted.map((size) => ({
      value: size.toLocaleUpperCase(),
      label: size.toLocaleUpperCase(),
      key: `size-${size.toLowerCase()}`,
    }));
  }, [sizeOptionsList]);

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

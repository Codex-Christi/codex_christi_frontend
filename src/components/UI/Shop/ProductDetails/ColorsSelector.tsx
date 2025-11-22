import React, { FC, useCallback, useMemo } from 'react';
import RadioButtonGroup from './RadioButtonGroupWithText';
import { ColorAttribute } from '@/app/shop/product/[id]/productDetailsSSR';
import { useCurrentVariant } from './currentVariantStore';

type ColorsSelectorProps = {
  colorOptionsList: ColorAttribute[];
};

// Main Component for Colors Selector
const ColorsSelector: FC<ColorsSelectorProps> = ({ colorOptionsList }) => {
  const { setColor } = useCurrentVariant();

  const uniqueColorOptions = useMemo(() => {
    if (!Array.isArray(colorOptionsList) || colorOptionsList.length === 0) {
      return [];
    }

    const mapped = colorOptionsList.map((opt) => ({
      label: opt.name ?? opt.attribute?.name ?? 'Color',
      value: opt.value,
      key: opt.slug ?? `${opt.value}-${opt.attribute?.name ?? 'color'}`,
    }));

    const uniqueColors = [
      ...new Map(mapped.map((obj) => [`${obj.label}:${obj.value}`.toLowerCase(), obj])).values(),
    ];

    return uniqueColors;
  }, [colorOptionsList]);

  const onChangeColor = useCallback(
    (value: string | { name: string; value: string }) => {
      const raw = typeof value === 'string' ? value : value?.value;
      if (!raw) return;

      const normalized = raw.toLowerCase();

      // Find the matching ColorAttribute from the list we were given.
      const matched = colorOptionsList.find((opt) => opt.value.toLowerCase() === normalized);

      if (!matched) {
        console.warn('[ColorsSelector:onChangeColor] No ColorAttribute matched for value:', value);
        return;
      }

      setColor(matched);
    },
    [colorOptionsList, setColor],
  );

  if (uniqueColorOptions.length === 0) return null;

  return (
    <div className='space-y-1'>
      <h4 className='text-xl'>Colors:</h4>
      <RadioButtonGroup props={uniqueColorOptions} onChange={onChangeColor} />
    </div>
  );
};

export default ColorsSelector;

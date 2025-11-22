// src/components/UI/Shop/ProductDetails/VariantAttributeSelector.tsx
import React, { useCallback, useMemo } from 'react';
import RadioButtonGroup from './RadioButtonGroupWithText';
import {
  ColorAttribute,
  SizeAttribute,
  ProductVariantOptions,
  LabelAttribute,
} from '@/app/shop/product/[id]/productDetailsSSR';
import { useCurrentVariant } from './currentVariantStore';

type AttributeKind = 'size' | 'color' | 'label';

type AttributeOption = ProductVariantOptions[number]; // base trait: has .value, .name, .slug, .attribute?

interface VariantAttributeSelectorProps<T extends AttributeOption> {
  title: string;
  attribute: AttributeKind;
  options: T[];
}

const VariantAttributeSelector = <T extends AttributeOption>({
  title,
  attribute,
  options,
}: VariantAttributeSelectorProps<T>) => {
  const { setSize, setColor, setLabel } = useCurrentVariant();

  const radioOptions = useMemo(() => {
    if (!Array.isArray(options) || options.length === 0) return [];

    const mapped = options.map((opt) => {
      const attrName = opt?.attribute?.name;
      return {
        label: opt.name ?? attrName ?? attribute,
        value: opt.value,
        key: opt.slug ?? `${opt.value}-${attrName ?? attribute}`,
      };
    });

    // de-dupe by label+value
    return [
      ...new Map(mapped.map((obj) => [`${obj.label}:${obj.value}`.toLowerCase(), obj])).values(),
    ];
  }, [options, attribute]);

  const onChange = useCallback(
    (value: string | { name: string; value: string }) => {
      const raw = typeof value === 'string' ? value : value?.value;
      if (!raw) return;

      const normalized = raw.toLowerCase();

      const matched = options.find((opt) => opt.value.toLowerCase() === normalized);

      if (!matched) {
        console.warn(`[VariantAttributeSelector:${attribute}] No option matched for value:`, value);
        return;
      }

      switch (attribute) {
        case 'size':
          setSize(matched as SizeAttribute);
          break;
        case 'color':
          setColor(matched as ColorAttribute);
          break;
        case 'label':
          setLabel(matched as LabelAttribute);
          break;
        default:
          console.warn('[VariantAttributeSelector] Unsupported attribute:', attribute);
      }
    },
    [attribute, options, setSize, setColor, setLabel],
  );

  if (radioOptions.length === 0) return null;

  return (
    <div className='space-y-1'>
      <h4 className='text-xl'>{title}</h4>
      <RadioButtonGroup props={radioOptions} onChange={onChange} />
    </div>
  );
};

export default VariantAttributeSelector;

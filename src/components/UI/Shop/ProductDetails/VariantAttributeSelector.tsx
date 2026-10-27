// src/components/UI/Shop/ProductDetails/VariantAttributeSelector.tsx
import React, { useCallback, useMemo } from 'react';
import RadioButtonGroup from './RadioButtonGroupWithText';
import {
  ColorAttribute,
  SizeAttribute,
  ProductVariantOptions,
  LabelAttribute,
} from '@/lib/merchizeStorefront/productTypes';
import { useCurrentVariant } from './currentVariantStore';
import {
  buildProductRadioOptions,
  type ProductOptionKind,
  type ProductOptionLayoutGroup,
} from '@/lib/merchizeStorefront/productOptionLayout';
import { Skeleton } from '../../primitives/skeleton';

type AttributeOption = ProductVariantOptions[number]; // base trait: has .value, .name, .slug, .attribute?

interface VariantAttributeSelectorProps<T extends AttributeOption> {
  title: string;
  attribute: ProductOptionKind;
  options: T[];
}

const VariantAttributeSelector = <T extends AttributeOption>({
  title,
  attribute,
  options,
}: VariantAttributeSelectorProps<T>) => {
  const { setSize, setColor, setLabel } = useCurrentVariant();

  const radioOptions = useMemo(
    () => buildProductRadioOptions(options, attribute),
    [options, attribute],
  );

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
      <RadioButtonGroup props={radioOptions} onChange={onChange} groupLabel={title} />
    </div>
  );
};

export default VariantAttributeSelector;

const ignorePlaceholderSelection = () => {};

export function VariantAttributeSkeleton({ title, options }: ProductOptionLayoutGroup) {
  return (
    <div className='space-y-1'>
      <Skeleton className='w-fit bg-white/10'>
        <h4 className='invisible text-xl'>{title}</h4>
      </Skeleton>
      <RadioButtonGroup props={options} onChange={ignorePlaceholderSelection} isLoading />
    </div>
  );
}

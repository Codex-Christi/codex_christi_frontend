import React, { useCallback, useMemo } from 'react';
import { useProductDetailsContext } from '.';
import {
  ColorAttribute,
  hasColorAndSize,
  ProductAttribute,
  SizeAttribute,
} from '@/app/shop/product/[id]/productDetailsSSR';
import dynamic from 'next/dynamic';
const RadioButtonGroup = dynamic(() =>
  import('./RadioButtonGroupWithText').then((mod) => mod.default)
);
import { useCurrentVariant } from './currentVariantStore';

function isColorAttribute(
  option: SizeAttribute | ColorAttribute | ProductAttribute | undefined
): option is ColorAttribute {
  const attr = option?.attribute;
  return (
    typeof attr === 'object' &&
    attr !== null &&
    'name' in attr &&
    (attr as { name: string }).name === 'Color'
  );
}

// Main Component for Colors Selector
const ColorsSelector = () => {
  // Hooks
  const { productVariants } = useProductDetailsContext();
  const productHasColorAndSize = hasColorAndSize(productVariants[0].options);
  const { setColor } = useCurrentVariant();

  //   Variables
  const uniqueColorOptions = useMemo(() => {
    if (productHasColorAndSize) {
      const arrayOfColors = productVariants.map((variant) => {
        const attr = variant.options[2];
        if (attr) {
          return { label: attr.name, value: attr.value, key: attr.slug };
        }
        return null;
      });

      const uniqueColors = [
        ...new Map(
          arrayOfColors
            .filter(
              (obj): obj is { label: string; value: string; key: string } =>
                obj !== null
            )
            .map((obj) => [`${obj.label}:${obj.value}`, obj])
        ).values(),
      ];

      return uniqueColors;
    }
    return [];
  }, [productHasColorAndSize, productVariants]);

  //   Handlers
  const onChangeColor = useCallback(
    (value: string | { name: string; value: string }) => {
      const colorValue = typeof value === 'string' ? value : value.value;
      const matched = productVariants.find(
        (variant) => variant.options[2]?.value === colorValue
      );

      const colorOption = matched?.options[2];

      if (isColorAttribute(colorOption)) {
        setColor(colorOption);
      } else {
        console.warn(
          '[onChangeSize] colorOption not valid ColorAttribute:',
          colorOption
        );
      }
    },
    [productVariants, setColor]
  );

  return (
    <>
      {/* Colors */}
      {productHasColorAndSize && (
        <div className='space-y-1'>
          <h4 className='text-xl'>Colors:</h4>

          <RadioButtonGroup
            props={uniqueColorOptions}
            onChange={onChangeColor}
          />
        </div>
      )}
    </>
  );
};

export default ColorsSelector;

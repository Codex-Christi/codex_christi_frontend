import React, { useCallback, useMemo } from 'react';
import { useProductDetailsContext } from '.';
import {
  ColorAttribute,
  hasColorAndSize,
} from '@/app/shop/product/[id]/productDetailsSSR';
import dynamic from 'next/dynamic';
const RadioButtonGroup = dynamic(() =>
  import('./RadioButtonGroupWithText').then((mod) => mod.default)
);

// Main Component for Colors Selector
const ColorsSelector = () => {
  // Hooks
  const { productVariants } = useProductDetailsContext();
  const productHasColorAndSize = hasColorAndSize(productVariants[0].options);

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
      if (typeof value === 'string') {
        const selectedColor = uniqueColorOptions.find(
          (option) => option.value === value
        );
        const { label, value: hexCode } = selectedColor || {
          label: '',
          value: '',
        };
        const searchObj = { name: label, value: hexCode } as ColorAttribute;

        console.log(searchObj);
      }
    },
    [uniqueColorOptions]
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

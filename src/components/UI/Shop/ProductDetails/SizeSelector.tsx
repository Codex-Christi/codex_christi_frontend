import RadioButtonGroup from './RadioButtonGroupWithText';
import { useProductDetailsContext } from '.';
import {
  ColorAttribute,
  hasColorAndSize,
  ProductAttribute,
  SizeAttribute,
} from '@/app/shop/product/[id]/productDetailsSSR';
import { FC, useCallback, useMemo } from 'react';
import { useCurrentVariant } from './currentVariantStore';

const sizeFormatArr = [
  'xs',
  's',
  'm',
  'l',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
  '6xl',
];
function isSizeAttribute(
  option: SizeAttribute | ColorAttribute | ProductAttribute | undefined
): option is SizeAttribute {
  const attr = option?.attribute;

  return (
    (typeof attr === 'object' &&
      attr !== null &&
      'name' in attr &&
      (attr as { name: string }).name === 'size') ||
    (attr as { name: string }).name === 'Size'
  );
}

// Main component for size selector
const SizeSelector: FC = () => {
  // Hooks
  const { productVariants } = useProductDetailsContext();
  const productHasColorAndSize = hasColorAndSize(productVariants[0].options);

  const { setSize } = useCurrentVariant();

  // Handlers
  // Handler for size change
  const onChangeSize = useCallback(
    (value: string | { name: string; value: string }) => {
      const sizeValue =
        typeof value === 'string'
          ? value.toLowerCase()
          : value.value.toLowerCase();

      const index = productHasColorAndSize ? 1 : 0;

      const matched = productVariants.find(
        (variant) => variant.options[index]?.value.toLowerCase() === sizeValue
      );

      const sizeOption = matched?.options[index];

      if (isSizeAttribute(sizeOption)) {
        setSize(sizeOption, matched!);
      } else {
        console.warn(
          '[onChangeSize] sizeOption not valid SizeAttribute:',
          sizeOption
        );
      }
    },
    [productHasColorAndSize, productVariants, setSize]
  );

  // Variables
  const sizesArr = productVariants.map((variant) => {
    const sizeOption = productHasColorAndSize
      ? variant.options[1]
      : variant.options[0];

    return sizeOption?.value.toUpperCase();
  });
  // Unique sizes from the varinats, sortedif product has color and size
  const uniqueSizesOptions = useMemo(
    () =>
      Array.from(
        new Set(
          productHasColorAndSize
            ? sizesArr.sort(
                (a, b) =>
                  sizeFormatArr.indexOf((a ?? '').toLowerCase()) -
                  sizeFormatArr.indexOf((b ?? '').toLocaleLowerCase())
              )
            : sizesArr
        )
      ).map((size) => ({
        value: size,
        label: size,
        key: `size-${(size ?? '').toLowerCase()}`,
      })),
    [productHasColorAndSize, sizesArr]
  );

  // JSX
  return (
    <section className='!space-y-6 pb-6'>
      {/* Sizes */}
      <div className='space-y-1'>
        <h4 className='text-xl'>Sizes:</h4>

        <RadioButtonGroup props={uniqueSizesOptions} onChange={onChangeSize} />
      </div>
    </section>
  );
};

export default SizeSelector;

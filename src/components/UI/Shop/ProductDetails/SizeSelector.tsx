import RadioButtonGroup from './RadioButtonGroupWithText';
import { useProductDetailsContext } from '.';
import { hasColorAndSize } from '@/app/shop/product/[id]/productDetailsSSR';
import { FC, useMemo } from 'react';

const onChangeSize = (value: string | { name: string; value: string }) => {
  if (typeof value === 'string') {
    console.log(`Selected size: ${value}`);
  }
};

const sizeFormatArr = ['xs', 's', 'm', 'l', 'xl', '2xl', '3xl', '4xl', '5xl'];

// Main component for size selector
const SizeSelector: FC = () => {
  // Hooks
  const { productVariants } = useProductDetailsContext();
  const productHasColorAndSize = hasColorAndSize(productVariants[0].options);

  // Variables
  const sizesArr = productVariants.map((variant) => {
    if (productHasColorAndSize) {
      return variant.options[1]?.value.toUpperCase();
    } else {
      return variant.options[0].value.toUpperCase();
    }
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

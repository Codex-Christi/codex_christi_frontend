import {
  hasColorAndSize,
  ProductVariantOptions,
} from '@/app/shop/product/[id]/productDetailsSSR';
import React, { FC } from 'react';

const SizeAndColorElem: FC<{
  options: ProductVariantOptions;
  className?: string;
}> = ({ options, className }) => {
  const isSizeAndColor = hasColorAndSize(options as ProductVariantOptions);

  return (
    <section className={`flex flex-col gap-1 ${className}`}>
      {isSizeAndColor && <h4>Color: {options[2]?.name}</h4>}
      <h4>
        Size:{' '}
        {isSizeAndColor
          ? options[1]?.value.toUpperCase()
          : options[0].value.toUpperCase()}
      </h4>
    </section>
  );
};

export default SizeAndColorElem;

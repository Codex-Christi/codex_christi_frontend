import { ProductVariantOptions } from '@/app/shop/product/[id]/productDetailsSSR';
import React, { FC } from 'react';

const SizeAndColorElem: FC<{
  options: ProductVariantOptions;
  className?: string;
}> = ({ options, className }) => {
  // Find options by attribute name, regardless of order.
  const sizeOption = options.find(
    (o: (typeof options)[number]) => o.attribute?.name?.toLowerCase() === 'size',
  );
  const colorOption = options.find(
    (o: (typeof options)[number]) => o.attribute?.name?.toLowerCase() === 'color',
  );

  const hasSize = Boolean(sizeOption);
  const hasColor = Boolean(colorOption);

  // Fallback: if no explicit "size" attribute, use the first option as "size-like"
  const fallbackSizeOption = !hasSize && options.length > 0 ? options[0] : null;

  return (
    <section className={`flex flex-col gap-1 ${className ?? ''}`}>
      {hasColor && (
        <h4 className={`capitalize`}>Color: {colorOption?.slug ?? colorOption?.value}</h4>
      )}
      {(hasSize || fallbackSizeOption) && (
        <h4>
          Size: {(sizeOption?.value ?? fallbackSizeOption?.value ?? '')?.toString().toUpperCase()}
        </h4>
      )}
    </section>
  );
};

export default SizeAndColorElem;

import { ProductVariantOptions } from '@/lib/merchizeStorefront/productTypes';
import React, { FC, useMemo } from 'react';
import { getColorAndSizeLabels, toCartOptions } from './cartOptionHelpers';

const SizeAndColorElem: FC<{
  options: ProductVariantOptions;
  className?: string;
}> = ({ options, className }) => {
  const { color, size } = useMemo(() => getColorAndSizeLabels(toCartOptions(options)), [options]);

  return (
    <section className={`flex flex-col gap-1 ${className ?? ''}`}>
      {color && <h4 className='capitalize'>Color: {color}</h4>}
      {size && <h4>Size: {`${size}`.toUpperCase()}</h4>}
    </section>
  );
};

export default SizeAndColorElem;

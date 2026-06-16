'use client';

import { useMemo } from 'react';
import { useHasMounted } from '@/lib/hooks/useHasMounted';
import { useCartStore } from '@/stores/shop_stores/cartStore';

export default function CartIconCount() {
  const variantsLength = useCartStore((state) => state.variants.length);
  const hasMounted = useHasMounted();
  const approxCartItems = useMemo(() => {
    if (!hasMounted) return 0;
    return variantsLength >= 9 ? '9+' : variantsLength;
  }, [hasMounted, variantsLength]);

  const cartIsMoreThanNine = approxCartItems === '9+';

  return (
    <text
      fill='#000'
      fontSize={cartIsMoreThanNine ? 10 : 13}
      fontWeight='bold'
      transform={cartIsMoreThanNine ? 'translate(17.5 10)' : 'translate(19.5 11.7)'}
    >
      {approxCartItems}
    </text>
  );
}

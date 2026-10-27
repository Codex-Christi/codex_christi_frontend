'use client';

import { useCartStore } from '@/stores/shop_stores/cartStore';
import { AlertTriangle } from 'lucide-react';

export default function CartIconCount() {
  const totalQuantity = useCartStore((state) =>
    state.hydrated ? state.variants.reduce((total, item) => total + item.quantity, 0) : 0,
  );
  const cartIsMoreThanNine = totalQuantity > 9;

  return (
    <text
      fill='#000'
      fontSize={cartIsMoreThanNine ? 10 : 13}
      fontWeight='bold'
      transform={cartIsMoreThanNine ? 'translate(17.5 10)' : 'translate(19.5 11.7)'}
    >
      {cartIsMoreThanNine ? '9+' : totalQuantity}
    </text>
  );
}

export function CartReviewBadge() {
  const count = useCartStore((state) => state.conflicts.length);
  if (!count) return null;
  return (
    <span className='absolute -right-2 -bottom-2 rounded-full bg-black p-0.5 text-amber-200'>
      <AlertTriangle aria-hidden='true' size={15} fill='currentColor' stroke='#111' />
    </span>
  );
}

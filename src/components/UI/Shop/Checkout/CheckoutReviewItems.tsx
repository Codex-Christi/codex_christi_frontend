import type { CheckoutReviewLine } from '@/lib/shop/checkout/checkoutReviewTypes';
import { formatOrderMoney } from '@/lib/shop/checkout/orderMoney';

export default function CheckoutReviewItems({
  lines,
  currency,
}: {
  lines: CheckoutReviewLine[];
  currency: string;
}) {
  return (
    <ul className='min-w-0 space-y-4'>
      {lines.map((line) => (
        <li
          key={`${line.productId}:${line.variantId}`}
          className='min-w-0 space-y-2 border-b border-white/15 pb-4 last:border-0 last:pb-0 [overflow-wrap:anywhere]'
        >
          <h4 className='text-sm font-semibold'>{line.title}</h4>
          {line.selectedOptions.length > 0 && (
            <dl className='space-y-1 text-sm text-white/75'>
              {line.selectedOptions.map(({ name, value }, index) => (
                <div key={`${name}:${value}:${index}`} className='flex min-w-0 flex-wrap gap-x-2'>
                  <dt>{name}:</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className='flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm'>
            <p className='text-white/75'>Quantity: {line.quantity}</p>
            <p className='font-semibold'>{formatOrderMoney(Number(line.lineAmount), currency)}</p>
          </div>
          <p className='text-xs text-white/60'>
            {formatOrderMoney(Number(line.unitAmount), currency)} each
          </p>
        </li>
      ))}
    </ul>
  );
}

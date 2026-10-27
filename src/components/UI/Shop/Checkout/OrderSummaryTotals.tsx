import { Skeleton } from '@/components/UI/primitives/skeleton';
import { formatOrderMoney } from '@/lib/shop/checkout/orderMoney';

type OrderSummaryTotalsProps = {
  retailPriceTotalNum?: number;
  shippingPriceNum?: number;
  totalPriceNum?: number;
  currency?: string;
  className?: string;
};

export default function OrderSummaryTotals({
  retailPriceTotalNum,
  shippingPriceNum,
  totalPriceNum,
  currency,
  className,
}: OrderSummaryTotalsProps) {
  const value = (amount?: number) =>
    amount != null && currency ? (
      <span className='min-w-0 text-right [overflow-wrap:anywhere]'>
        {formatOrderMoney(amount, currency)}
      </span>
    ) : (
      <Skeleton aria-label='Updating price' className='ml-auto h-5 w-20 bg-white/10' />
    );
  return (
    <dl className={`space-y-2 text-sm text-[#F3F3F3] ${className ?? ''}`}>
      <div className='grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,auto)] items-baseline gap-3'>
        <dt>Subtotal</dt>
        <dd>{value(retailPriceTotalNum)}</dd>
      </div>
      <div className='grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,auto)] items-baseline gap-3'>
        <dt>Shipping / delivery</dt>
        <dd>{value(shippingPriceNum)}</dd>
      </div>
      <div className='grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,auto)] items-baseline gap-3 border-t border-white/30 pt-3 text-lg font-semibold'>
        <dt>
          Total
          {currency && <span className='ml-2 text-xs font-normal text-white/65'>{currency}</span>}
        </dt>
        <dd>{value(totalPriceNum)}</dd>
      </div>
    </dl>
  );
}

import { Skeleton } from '@/components/UI/primitives/skeleton';
import { CSSProperties, LegacyRef } from 'react';

type OrderSummaryTotalsProps = {
  slim?: boolean;
  className?: string;
  cartCount: number;
  retailPriceTotalNum?: number;
  shippingPriceNum?: number;
  currency?: string;
  currency_symbol?: string;
  ref?: LegacyRef<HTMLDivElement>;
  style?: CSSProperties;
};

const skel = (cls: string) => <Skeleton className={`${cls} bg-white/10`} />;

const OrderSummaryTotals = ({
  slim,
  className,
  cartCount,
  retailPriceTotalNum,
  shippingPriceNum,
  currency,
  currency_symbol,
  ref,
  style,
}: OrderSummaryTotalsProps) => {
  const isSlim = !!slim;
  const hasPricing =
    retailPriceTotalNum != null && shippingPriceNum != null && !!currency && !!currency_symbol;

  const subtotal = hasPricing ? `${currency_symbol} ${retailPriceTotalNum}` : '';
  const shipping = hasPricing ? `${currency_symbol} ${shippingPriceNum}` : '';
  const total = hasPricing
    ? `${((retailPriceTotalNum ?? 0) + (shippingPriceNum ?? 0)).toLocaleString()} ${currency}`
    : '';

  const rows: Array<[label: string, value: string, skeletonClass: string]> = isSlim
    ? [
        ['Subtotal', subtotal, 'h-3 w-20'],
        ['Shipping', shipping, 'h-3 w-16'],
      ]
    : [
        ['Subtotal', subtotal, 'h-4 w-20'],
        ['Shipping/Delivery Fee', shipping, 'h-4 w-24'],
      ];

  const cartPlural = cartCount === 1 ? 'item' : 'items';

  const renderValue = (value: string, skeletonClass: string, valueClassName?: string) =>
    hasPricing ? <span className={valueClassName}>{value}</span> : skel(skeletonClass);

  const rowWrapClass = isSlim
    ? 'flex items-center justify-between gap-3'
    : 'flex items-center justify-between gap-4 font-semibold';
  const rowsContainerClass = isSlim ? 'space-y-1 text-xs' : 'space-y-2 text-[#F3F3F3]';
  const labelClass = isSlim ? 'text-white/95' : undefined;
  const defaultValueClass = isSlim ? 'font-medium' : undefined;

  const Rows = (
    <div className={rowsContainerClass}>
      {rows.map(([label, value, skeletonClass]) => (
        <div key={label} className={rowWrapClass}>
          <span className={labelClass}>{label}</span>
          {renderValue(value, skeletonClass, defaultValueClass)}
        </div>
      ))}
    </div>
  );

  const TotalLine = isSlim ? (
    <div className='mt-2 flex items-center justify-between gap-3 border-t border-white/10 pt-2'>
      <span className='text-sm font-semibold'>Total</span>
      {renderValue(total, 'h-4 w-24', 'text-sm font-semibold')}
    </div>
  ) : (
    <div className='flex items-center justify-between gap-4 mt-5 font-semibold text-[#F3F3F3]'>
      <span>Total</span>
      {renderValue(total, 'h-5 w-28', 'text-xl')}
    </div>
  );

  if (!isSlim) {
    return (
      <div className={className ?? ''} ref={ref}>
        {Rows}
        {TotalLine}
      </div>
    );
  }

  return (
    <div
      className={`rounded-t-[10px] border border-white/10 bg-black/75 px-3 py-3 text-[#F3F3F3] 
        backdrop-blur-[12px] ${className ? ` ${className}` : ''}`}
      ref={ref}
      style={style}
    >
      <div className='flex items-center justify-between gap-3 pb-2'>
        <span className='text-sm font-semibold'>Order Summary</span>
        <span className='text-xs font-medium text-white'>{`${cartCount} ${cartPlural}`}</span>
      </div>
      {/* {Rows} */}
      {TotalLine}
    </div>
  );
};

export default OrderSummaryTotals;

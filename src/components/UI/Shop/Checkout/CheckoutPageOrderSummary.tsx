'use client';

import { useContext, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ServerOrderDetailsContext } from './ServerOrderDetailsComponent';
import { useCartStore, type CartVariant } from '@/stores/shop_stores/cartStore';
import { MiniCartList } from '../Cart/MiniCartList';
import OrderSummaryTotals from './OrderSummaryTotals';
import { formatOrderMoney, type OrderPreviewTotals } from '@/lib/shop/checkout/orderMoney';

export default function CheckoutPageOrderSummary() {
  const details = useContext(ServerOrderDetailsContext);
  const cartItems = useCartStore((state) => state.variants);
  return (
    <CheckoutOrderSummaryView cartItems={cartItems} prices={details?.finalPricesWithShippingFee} />
  );
}

export function CheckoutOrderSummaryView({
  cartItems,
  prices,
}: {
  cartItems: CartVariant[];
  prices?: OrderPreviewTotals;
}) {
  const [expanded, setExpanded] = useState(false);
  const quantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <aside
      aria-label='Order summary'
      className='order-1 min-w-0 rounded-2xl bg-[#222]/95 p-4 sm:p-6 lg:order-2 lg:p-7'
    >
      <button
        type='button'
        aria-expanded={expanded}
        aria-controls='checkout-order-summary'
        onClick={() => setExpanded((value) => !value)}
        className='flex min-h-11 w-full min-w-0 items-center justify-between gap-3 text-left lg:hidden'
      >
        <span className='min-w-0'>
          <span className='block text-xl font-semibold'>Order summary</span>
          <span className='mt-1 block text-sm text-white/65'>
            {quantity} {quantity === 1 ? 'item' : 'items'}
          </span>
        </span>
        <span className='flex min-w-0 items-center gap-2 lg:hidden'>
          {prices && (
            <span className='text-sm font-semibold [overflow-wrap:anywhere]'>
              {formatOrderMoney(prices.totalPriceNum, prices.currency)}
            </span>
          )}
          <ChevronDown
            size={20}
            aria-hidden='true'
            className={`shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </span>
      </button>
      <h2 className='hidden text-xl font-semibold lg:block'>
        <span>Order summary</span>
        <span className='mt-1 block text-sm font-normal text-white/65'>
          {quantity} {quantity === 1 ? 'item' : 'items'}
        </span>
      </h2>
      <div
        id='checkout-order-summary'
        className={`${expanded ? 'block' : 'hidden'} mt-5 space-y-6 border-t border-white/25 pt-5 lg:block`}
      >
        <MiniCartList
          items={cartItems}
          showQuantityControls={false}
          showRemoveButton={false}
          variant='compact'
          confirmBeforeRemove
          prices={prices}
        />
        <div>
          <label htmlFor='checkout-discount-code' className='sr-only'>
            Discount code
          </label>
          <div className='grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3'>
            <input
              id='checkout-discount-code'
              type='text'
              disabled
              placeholder='Coupon or discount code'
              aria-describedby='checkout-discount-note'
              className='min-h-11 w-full min-w-0 rounded-xl border border-white/35 bg-transparent px-3 text-sm placeholder:text-white/55 disabled:cursor-not-allowed'
            />
            <button
              type='button'
              disabled
              className='min-h-11 rounded-xl bg-white/25 px-4 text-sm font-semibold text-white/60 disabled:cursor-not-allowed'
            >
              Apply
            </button>
          </div>
          <p id='checkout-discount-note' className='mt-2 text-xs text-white/60'>
            Discount codes aren’t available yet.
          </p>
        </div>
        <OrderSummaryTotals
          retailPriceTotalNum={prices?.retailPriceTotalNum}
          shippingPriceNum={prices?.shippingPriceNum}
          totalPriceNum={prices?.totalPriceNum}
          currency={prices?.currency}
        />
      </div>
    </aside>
  );
}

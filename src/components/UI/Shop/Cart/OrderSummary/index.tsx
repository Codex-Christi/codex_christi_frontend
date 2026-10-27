'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { FC } from 'react';
import { FaAngleRight } from 'react-icons/fa6';
import CustomShopLink from '../../HelperComponents/CustomShopLink';
import { Button } from '@/components/UI/primitives/button';
import { formatOrderMoney, type OrderPreviewTotals } from '@/lib/shop/checkout/orderMoney';
import { useCartStore } from '@/stores/shop_stores/cartStore';

type OrderSummaryProps = {
  /** ISO-3 destination country code, e.g. 'USA', 'GBR', 'CAN'. Defaults to 'USA'. */
  countryIso3?: string;
  checkoutBlocked?: boolean;
  totals: OrderPreviewTotals | null;
  quotePending?: boolean;
  quoteError?: string | null;
  onRetryQuote?: () => void;
};

const DeliveryCountryDropdown = dynamic(() => import('../../Index/CountryDropDownClientFloating'));

// Main Component
const OrderSummary: FC<OrderSummaryProps> = ({
  countryIso3 = 'USA',
  checkoutBlocked = false,
  totals,
  quotePending = false,
  quoteError,
  onRetryQuote,
}) => {
  const hasConflicts = useCartStore((state) => state.conflicts.length > 0);
  const price = (amount?: number) =>
    totals && amount != null ? formatOrderMoney(amount, totals.currency) : '—';

  // JSX
  return (
    <section className='flex w-full min-w-0 max-w-full select-none flex-col rounded-[20px] bg-[#3D3D3D4D] px-4 py-6 text-white backdrop-blur-[5px] sm:px-5 sm:py-8 lg:sticky lg:top-6 lg:self-start'>
      {/* Header */}
      <h1 className='mb-4 min-w-0 break-words text-left font-ocr text-[clamp(1.5rem,4vw,2rem)] font-light leading-snug text-white'>
        Order Summary
      </h1>

      <div className='grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3 pt-6 text-lg font-semibold'>
        <span className='min-w-0 break-words'>Subtotal</span>
        <span className='min-w-0 text-right [overflow-wrap:anywhere]'>
          {price(totals?.retailPriceTotalNum)}
        </span>
      </div>

      {totals && (
        <>
          <div className='grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3 pt-2 text-base font-semibold'>
            <span className='min-w-0 break-words'>
              Est. Shipping Fee <span className='font-extrabold'>**</span>
            </span>
            <span className='min-w-0 text-right [overflow-wrap:anywhere]'>
              {price(totals.shippingPriceNum)}
            </span>
          </div>

          <p className='font-semibold pt-8 leading-relaxed text-sm sm:text-base'>
            <span className='font-extrabold'>**</span> &nbsp; Shipping fee varies by location.{' '}
            <br />
            <Link
              className='font-normal text-blue-200 underline underline-offset-2'
              href='/shop/help/shipping-rates-and-supported-countries'
              target='_blank'
            >
              Learn more
            </Link>
          </p>
        </>
      )}

      {!totals && (
        <p className='text-sm text-white/60 pt-6'>
          Shipping is calculated at checkout once we know your delivery details.
        </p>
      )}

      <div className='mt-8 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3 border-t border-white/10 pt-6 text-lg font-semibold'>
        <span className='min-w-0 break-words'>Estimated Total</span>
        <span className='min-w-0 text-right [overflow-wrap:anywhere]'>
          {price(totals?.totalPriceNum)}
        </span>
      </div>

      {hasConflicts || checkoutBlocked || quotePending || quoteError || !totals ? (
        <>
          <p role='status' className='min-w-0 break-words pt-6 text-sm text-white/80'>
            {hasConflicts
              ? 'Please review the highlighted cart changes before checkout.'
              : quotePending
                ? 'Updating delivery options...'
                : (quoteError ??
                  'Please remove unavailable items or choose another option before checkout.')}
          </p>
          {quoteError && !quotePending && (
            <div className='mt-3 space-y-3'>
              <button type='button' className='underline underline-offset-4' onClick={onRetryQuote}>
                Try again
              </button>
              <DeliveryCountryDropdown
                initialIso3={countryIso3}
                wrapperClassName=''
                classNames={{
                  trigger:
                    'flex min-h-10 w-full min-w-0 max-w-full items-center gap-2 rounded-md border border-white/20 bg-black/40 px-3 text-white',
                  popover: 'w-[min(320px,calc(100vw-2rem))] p-0 !z-[500]',
                }}
              />
            </div>
          )}
          <Button
            name='Proceed to Checkout'
            type='button'
            disabled
            aria-disabled='true'
            className='mt-4 !flex w-full min-w-0 items-center justify-center gap-2 whitespace-normal rounded-3xl bg-white px-3 py-4 text-center text-base text-black sm:text-lg'
          >
            <span className='min-w-0'>Proceed to Checkout</span>{' '}
            <FaAngleRight className='shrink-0' size={20} />
          </Button>
        </>
      ) : (
        <CustomShopLink
          href='/shop/checkout'
          className='mt-6 !flex w-full min-w-0 items-center justify-center gap-2 rounded-3xl bg-white px-3 py-4 text-center text-base text-black hover:bg-gray-200 sm:text-lg'
        >
          <span className='min-w-0'>Proceed to Checkout</span>{' '}
          <FaAngleRight className='shrink-0' size={20} />
        </CustomShopLink>
      )}
    </section>
  );
};

export default OrderSummary;

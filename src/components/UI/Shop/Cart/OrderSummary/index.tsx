'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { FC } from 'react';
import { FaAngleRight } from 'react-icons/fa6';
import CustomShopLink from '../../HelperComponents/CustomShopLink';
import { Button } from '@/components/UI/primitives/button';
import { formatOrderMoney, type OrderPreviewTotals } from '@/lib/shop/checkout/orderMoney';

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
  const price = (amount?: number) =>
    totals && amount != null ? formatOrderMoney(amount, totals.currency) : '—';

  // JSX
  return (
    <section
      className='bg-[#3D3D3D4D] backdrop-blur-[5px] text-white rounded-[20px] 
     w-full sm:w-[85vw] md:w-[80vw] lg:!w-[35%] xl:!w-[32.5%] py-8 lg:self-start mx-auto
     px-5 flex flex-col select-none md:sticky md:top-6'
    >
      {/* Header */}
      <h1
        className=' font-light text-white text-4xl font-ocr text-left mb-4
      underline underline-offset-[1.5rem] lg:no-underline xl:underline select-none'
      >
        Order Summary
      </h1>

      <div className='pt-8 font-semibold flex flex-wrap gap-3 text-xl items-center max-[1289px]:text-lg'>
        <span className='flex-1 min-w-[55%]'>Subtotal</span>
        <span className='flex-1 min-w-[35%] text-right'>{price(totals?.retailPriceTotalNum)}</span>
      </div>

      {totals && (
        <>
          <div className='pt-2 font-semibold flex flex-wrap gap-3 text-lg items-center max-[1289px]:text-base'>
            <span className='flex-1 min-w-[55%]'>
              Est. Shipping Fee <span className='font-extrabold'>**</span>
            </span>
            <span className='flex-1 min-w-[35%] text-right px-0'>
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

      <div className='mt-8 border-t border-white/10 pt-6 flex flex-wrap gap-3 items-center text-xl font-semibold max-[1289px]:text-xl'>
        <span className='flex-1 min-w-[55%]'>Estimated Total</span>
        <span className='flex-1 min-w-[35%] text-right'>{price(totals?.totalPriceNum)}</span>
      </div>

      {checkoutBlocked || quotePending || quoteError || !totals ? (
        <>
          <p role='status' className='pt-6 text-sm text-white/80'>
            {quotePending
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
                    'inline-flex min-h-10 max-w-full items-center gap-2 rounded-md border border-white/20 bg-black/40 px-3 text-white',
                }}
              />
            </div>
          )}
          <Button
            name='Proceed to Checkout'
            type='button'
            disabled
            aria-disabled='true'
            className='w-[95%] text-center !mx-auto py-4 px-4 text-xl mt-4 rounded-3xl bg-white text-black gap-2 !flex justify-center items-center'
          >
            <span>Proceed to Checkout</span> <FaAngleRight size={22.5} />
          </Button>
        </>
      ) : (
        <CustomShopLink
          href='/shop/checkout'
          className='w-[95%] text-center !mx-auto py-4 px-4 text-xl mt-10 rounded-3xl bg-white text-black hover:bg-gray-200 gap-2 !flex justify-center items-center'
        >
          <h4>Proceed to Checkout</h4> <FaAngleRight size={22.5} />
        </CustomShopLink>
      )}
    </section>
  );
};

export default OrderSummary;

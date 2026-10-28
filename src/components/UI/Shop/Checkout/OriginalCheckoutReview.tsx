'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Package } from 'lucide-react';
import type { OriginalCheckout } from '@/lib/shop/checkout/originalCheckout';
import { formatOrderMoney } from '@/lib/shop/checkout/orderMoney';
import {
  CheckoutPaymentMethods,
  CheckoutPaymentReviewContext,
  type CheckoutOptions,
} from './PaymentSection';
import CustomShopLink from '../HelperComponents/CustomShopLink';

export default function OriginalCheckoutReview({
  checkout,
  onBack,
  renderPayment,
}: {
  checkout: OriginalCheckout;
  onBack: () => void;
  renderPayment: (mode: CheckoutOptions) => ReactNode;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [mode, setMode] = useState<CheckoutOptions>('');
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const money = (amount: number | string) =>
    formatOrderMoney(Number(amount), checkout.quote.currency);
  const address = checkout.deliveryAddress;
  return (
    <CheckoutPaymentReviewContext.Provider
      value={{
        originalCheckout: checkout,
        review: acknowledged ? { acknowledged: true, quote: checkout.quote } : null,
        onPaymentError: (message) => {
          setError(message);
          setAcknowledged(false);
        },
      }}
    >
      <div className='mt-5 min-w-0 space-y-5 border-t border-white/20 pt-5'>
        <header className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <h2 ref={heading} tabIndex={-1} className='text-xl font-semibold outline-none'>
              Your original purchase
            </h2>
            <p className='mt-2 text-sm leading-6 text-white/75'>
              Continue with these saved items and this total. Extra items in your cart stay there.
            </p>
          </div>
          <button type='button' onClick={onBack} className='min-h-11 text-sm underline'>
            Back to current cart
          </button>
        </header>
        <div className='grid min-w-0 items-start gap-6 lg:grid-cols-2'>
          <div className='min-w-0 space-y-4'>
            <div
              role='region'
              aria-label='Items in your original purchase'
              tabIndex={0}
              className='scrollbar max-h-80 overflow-x-hidden overflow-y-auto overscroll-contain pr-2'
            >
              <ul className='space-y-3 [container-type:inline-size]'>
                {checkout.lines.map((line) => (
                  <li
                    key={line.id}
                    className='grid min-w-0 grid-cols-[48px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 [@container(min-width:22rem)]:grid-cols-[48px_minmax(0,1fr)_auto]'
                  >
                    {line.image ? (
                      <Image
                        src={line.image}
                        alt=''
                        width={48}
                        height={56}
                        className='row-span-2 h-14 w-12 rounded-lg object-cover object-top'
                      />
                    ) : (
                      <Package className='row-span-2 h-12 w-12' aria-hidden='true' />
                    )}
                    <h3 className='min-w-0 text-sm font-medium [overflow-wrap:anywhere]'>
                      {line.title}
                    </h3>
                    <span className='col-start-2 text-sm font-semibold [@container(min-width:22rem)]:col-start-3 [@container(min-width:22rem)]:row-start-1'>
                      {money(line.lineAmount)}
                    </span>
                    <p className='col-start-2 text-xs leading-5 text-white/70'>
                      {line.options}
                      {line.options ? ' · ' : ''}Quantity: {line.quantity}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
            <dl className='space-y-2 border-t border-white/20 pt-4 text-sm'>
              <div className='flex justify-between gap-3'>
                <dt>Items</dt>
                <dd>{money(checkout.quote.subtotal)}</dd>
              </div>
              <div className='flex justify-between gap-3'>
                <dt>Delivery</dt>
                <dd>{money(checkout.quote.shipping)}</dd>
              </div>
              <div className='flex justify-between gap-3 pt-2 font-semibold'>
                <dt>Total to pay</dt>
                <dd>
                  {money(checkout.quote.total)} {checkout.quote.currency}
                </dd>
              </div>
            </dl>
          </div>
          <section
            className='min-w-0 text-sm leading-6 [overflow-wrap:anywhere]'
            aria-label='Original delivery details'
          >
            <h3 className='mb-2 font-semibold'>Delivery details</h3>
            <p>{checkout.customer.name}</p>
            <p>{checkout.customer.email}</p>
            <address className='mt-2 not-italic'>
              {address.shipping_address_line_1}
              <br />
              {address.shipping_address_line_2 && (
                <>
                  {address.shipping_address_line_2}
                  <br />
                </>
              )}
              {[address.shipping_city, address.shipping_state, address.zip_code]
                .filter(Boolean)
                .join(', ')}
              <br />
              {address.shipping_country}
            </address>
          </section>
        </div>
        <label className='flex min-h-11 items-start gap-3 text-sm leading-6'>
          <input
            type='checkbox'
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className='mt-1 h-5 w-5 shrink-0 accent-[#0085ff]'
          />
          <span>I’ve checked this original purchase, delivery address, and total.</span>
        </label>
        <p className='text-xs leading-5 text-white/65'>
          These items are made to order.{' '}
          <CustomShopLink href='/shop/terms-of-use' className='underline'>
            Terms (draft)
          </CustomShopLink>{' '}
          ·{' '}
          <CustomShopLink href='/shop/privacy-policy' className='underline'>
            Privacy (draft)
          </CustomShopLink>
        </p>
        <CheckoutPaymentMethods value={mode} onChange={setMode} />
        {error && (
          <p role='alert' className='text-sm leading-6 text-amber-100'>
            {error}
          </p>
        )}
        {acknowledged && mode && renderPayment(mode)}
      </div>
    </CheckoutPaymentReviewContext.Provider>
  );
}

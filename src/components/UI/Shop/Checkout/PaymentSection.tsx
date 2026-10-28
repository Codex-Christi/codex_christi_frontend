'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';
import { createContext, useContext, useState, type ContextType, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import PayPal from '@/assets/img/paypal.png';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import { CheckoutAccordionContext } from './ProductCheckout';
import { ServerOrderDetailsContext } from './ServerOrderDetailsComponent';
import { useCartStore, type CartVariant } from '@/stores/shop_stores/cartStore';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { useDjangoOrderIntentStore } from '@/stores/shop_stores/checkoutStore/djangoOrderIntentStore';
import { usePayPalIntentStore } from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import { formatOrderMoney } from '@/lib/shop/checkout/orderMoney';
import {
  checkoutReviewIdentity,
  createCheckoutReview,
  type CheckoutReview,
  type CheckoutContact,
  createCheckoutInput,
  checkoutInputIdentity,
  hasDifferentBoundCheckout,
} from './checkoutReview';
import { applyCheckoutSetupFailure } from './checkoutSetupFailure';
import type { OriginalCheckout } from '@/lib/shop/checkout/originalCheckout';

const PayPalCheckout = dynamic(() => import('./Paypal/PayPalMainCheckoutComponent'));
export type CheckoutOptions = 'card' | 'paypal_buttons' | '';
export const CheckoutPaymentReviewContext = createContext<{
  review: CheckoutReview | null;
  originalCheckout?: OriginalCheckout;
  onPaymentError: (message: string, code?: string) => void;
}>({ review: null, onPaymentError: () => {} });

type CheckoutPaymentViewProps = {
  cart: CartVariant[];
  checkout: CheckoutContact;
  details: ContextType<typeof ServerOrderDetailsContext>;
  canContinue: boolean;
  onEdit: () => void;
  onRefreshQuote: () => void;
  onVerificationRequired: (message: string) => void;
  renderPayment: (mode: CheckoutOptions) => ReactNode;
  previousOrderToken?: string;
  paymentBlocked?: boolean;
};

export default function PaymentSection() {
  const { handleOpenItem, canContinue, refreshQuote, requestVerification } =
    useContext(CheckoutAccordionContext);
  const details = useContext(ServerOrderDetailsContext);
  const cart = useCartStore((state) => state.variants);
  const checkout = useShopCheckoutStore(
    useShallow(({ first_name, last_name, email, delivery_address }) => ({
      first_name,
      last_name,
      email,
      delivery_address,
    })),
  );
  const attempt = usePayPalIntentStore((state) => state.checkoutAttempt);
  const intentUuid = useDjangoOrderIntentStore((state) => state.djangoOrderIntentUuid);
  const inputKey = details
    ? checkoutInputIdentity(
        createCheckoutInput(cart, checkout, intentUuid),
        createCheckoutReview(details.finalPricesWithShippingFee),
      )
    : '';
  const paymentBlocked = hasDifferentBoundCheckout(attempt, inputKey);
  return (
    <CheckoutPaymentView
      cart={cart}
      checkout={checkout}
      details={details}
      canContinue={canContinue}
      paymentBlocked={paymentBlocked}
      previousOrderToken={attempt?.orderToken}
      onEdit={() => handleOpenItem('basic-checkout-info')}
      onRefreshQuote={refreshQuote}
      onVerificationRequired={requestVerification}
      renderPayment={(mode) => <PayPalCheckout mode={mode} />}
    />
  );
}

export function CheckoutPaymentView({
  cart,
  checkout,
  details,
  canContinue,
  onEdit,
  onRefreshQuote,
  onVerificationRequired,
  renderPayment,
  paymentBlocked,
  previousOrderToken,
}: CheckoutPaymentViewProps) {
  const [payOption, setPayOption] = useState<CheckoutOptions>('');
  const [acceptedReview, setAcceptedReview] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const prices = details?.finalPricesWithShippingFee;
  const reviewKey = prices ? checkoutReviewIdentity(cart, checkout, prices) : null;
  const acknowledged = Boolean(reviewKey && acceptedReview === reviewKey && canContinue);
  const address = checkout.delivery_address;
  const quantity = cart.reduce((total, line) => total + line.quantity, 0);
  const countryName = details?.countrySupport.country?.country_name ?? address.shipping_country;
  const review = acknowledged && prices ? createCheckoutReview(prices) : null;
  const onPaymentError = (message: string, code?: string) => {
    applyCheckoutSetupFailure(
      { message, code },
      {
        showMessage: setPaymentError,
        resetReview: () => setAcceptedReview(null),
        refreshQuote: onRefreshQuote,
        verifyDetails: onVerificationRequired,
      },
    );
  };

  return (
    <CheckoutPaymentReviewContext.Provider value={{ review, onPaymentError }}>
      <div className='min-w-0 space-y-5'>
        <header className='flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-white/25 pb-4'>
          <h2 className='text-xl font-semibold'>Review & payment</h2>
          <button
            type='button'
            onClick={onEdit}
            className='inline-flex min-h-11 items-center gap-2 text-sm text-white/75 hover:text-white'
          >
            <ArrowLeft size={16} aria-hidden='true' /> Edit delivery
          </button>
        </header>
        <section
          aria-labelledby='checkout-final-review'
          className='min-w-0 border-b border-white/20 pb-4'
        >
          <h3 id='checkout-final-review' className='font-semibold'>
            Delivery details
          </h3>
          <div className='mt-3 text-sm leading-6 text-white/75 [overflow-wrap:anywhere]'>
            <p className='font-medium text-white'>
              {checkout.first_name} {checkout.last_name}
            </p>
            <p>{checkout.email}</p>
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
              {countryName}
            </address>
          </div>
          <p className='mt-3 text-sm text-white/75'>
            {quantity} {quantity === 1 ? 'item' : 'items'} in your order
          </p>
          <div className='mt-4 flex min-w-0 flex-wrap items-baseline justify-between gap-2 border-t border-white/20 pt-4'>
            <span className='font-semibold'>Total to pay</span>
            <strong className='text-lg [overflow-wrap:anywhere]'>
              {prices
                ? `${formatOrderMoney(prices.totalPriceNum, prices.currency)} ${prices.currency}`
                : 'Updating…'}
            </strong>
          </div>
        </section>
        <label className='flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-6'>
          <input
            type='checkbox'
            checked={acknowledged}
            disabled={!canContinue}
            onChange={(event) => setAcceptedReview(event.target.checked ? reviewKey : null)}
            className='mt-1 h-5 w-5 shrink-0 accent-[#0085ff]'
          />
          <span>I’ve checked the delivery address, items, quantities, and total.</span>
        </label>
        <p className='-mt-3 text-xs leading-5 text-white/60'>
          Please review your details carefully; these items are made to order.{' '}
          <CustomShopLink href='/shop/terms-of-use' className='underline'>
            Terms (draft)
          </CustomShopLink>{' '}
          ·{' '}
          <CustomShopLink href='/shop/privacy-policy' className='underline'>
            Privacy (draft)
          </CustomShopLink>
        </p>
        <CheckoutPaymentMethods value={payOption} onChange={setPayOption} />
        {paymentError && (
          <p
            role='alert'
            className='rounded-xl border border-amber-200/30 p-3 text-sm leading-6 text-amber-100'
          >
            {paymentError}
          </p>
        )}
        {!acknowledged && (
          <p role='status' className='text-sm text-white/65'>
            Confirm the order details above to continue to payment.
          </p>
        )}
        {paymentBlocked && previousOrderToken && (
          <p
            role='status'
            className='rounded-xl border border-amber-200/30 p-4 text-sm leading-6 text-amber-100'
          >
            An earlier checkout still needs checking before you pay for these details.{' '}
            <CustomShopLink
              href={`/shop/checkout/confirmation/${encodeURIComponent(previousOrderToken)}`}
              className='font-semibold underline'
            >
              View earlier checkout
            </CustomShopLink>
            , or use its status options above.
          </p>
        )}
        {acknowledged && payOption && !paymentBlocked && renderPayment(payOption)}
        <p className='flex items-center justify-center gap-2 text-xs text-white/60'>
          <ShieldCheck size={14} aria-hidden='true' /> Payment details and authentication are
          handled by PayPal.
        </p>
      </div>
    </CheckoutPaymentReviewContext.Provider>
  );
}

export function CheckoutPaymentMethods({
  value,
  onChange,
}: {
  value: CheckoutOptions;
  onChange: (value: CheckoutOptions) => void;
}) {
  return (
    <fieldset className='min-w-0'>
      <legend className='mb-3 font-semibold'>Payment method</legend>
      <div className='flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2'>
        {(['card', 'paypal_buttons'] as const).map((method) => (
          <label
            key={method}
            className='inline-flex min-h-11 cursor-pointer items-center gap-2 py-2'
          >
            <input
              type='radio'
              name='checkout-payment-method'
              value={method}
              checked={value === method}
              onChange={() => onChange(method)}
              className='h-5 w-5 shrink-0 accent-[#0085ff]'
            />
            {method === 'card' ? (
              <span className='text-sm font-medium'>Credit / debit card</span>
            ) : (
              <Image src={PayPal} alt='PayPal' className='h-auto w-10' />
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

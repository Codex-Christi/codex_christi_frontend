'use client';

import { type FC, useCallback, useContext, useEffect, useId, useState } from 'react';
import {
  PayPalCardFieldsProvider,
  PayPalCVVField,
  PayPalExpiryField,
  PayPalNameField,
  PayPalNumberField,
  usePayPalCardFields,
} from '@paypal/react-paypal-js';
import type { OnApproveData } from '@paypal/paypal-js';
import { Loader2 } from 'lucide-react';
import { CountryDropdown } from '@/components/UI/primitives/country-dropdown';
import { Input } from '@/components/UI/primitives/input';
import type { CheckoutOptions } from '../PaymentSection';
import { CheckoutPaymentReviewContext } from '../PaymentSection';
import { ServerOrderDetailsContext } from '../ServerOrderDetailsComponent';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { billingAddressFromDelivery, checkoutBillingAddressSchema } from '../checkoutAddress';
import type { BillingAddressInterface } from '@/lib/paypal/createPayPalOrder';
import { formatOrderMoney } from '@/lib/shop/checkout/orderMoney';
import PayPalLoadingSkeleton from './PayPalLoadingSkeleton';
import { boundedCheckoutRequest } from '@/lib/hooks/shopHooks/checkout/boundedCheckoutRequest';
import { usePayPalIntentStore } from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import CustomShopLink from '../../HelperComponents/CustomShopLink';

export interface MyPayPalCardFieldInterface {
  mode: CheckoutOptions;
  createOrder: () => Promise<string>;
  onApprove: (data: OnApproveData) => Promise<void>;
}

const cardFieldStyles = {
  input: {
    background: 'transparent',
    border: '1px solid #fff',
    'border-radius': '10px',
    outline: 'none',
    color: '#fff',
    'font-size': '16px',
    'font-family': 'Inter, Arial, sans-serif',
    padding: '12px',
  },
  'input:focus': { outline: 'none', 'box-shadow': '0 0 0 1px #fff' },
  'input::placeholder': { color: '#ccc' },
  '.invalid': { color: '#fda4af' },
};

const billingFields = [
  { name: 'addressLine1', label: 'Street address', autoComplete: 'billing address-line1' },
  {
    name: 'addressLine2',
    label: 'Apartment, suite, etc. (optional)',
    autoComplete: 'billing address-line2',
  },
  { name: 'adminArea2', label: 'City / town', autoComplete: 'billing address-level2' },
  { name: 'adminArea1', label: 'State / province', autoComplete: 'billing address-level1' },
  { name: 'postalCode', label: 'Postal code', autoComplete: 'billing postal-code' },
] as const;

const MyPayPalCardFields: FC<MyPayPalCardFieldInterface> = ({ mode, createOrder, onApprove }) => {
  const [retry, setRetry] = useState(0);
  if (mode !== 'card') return null;
  return (
    <CardFieldsSession
      key={retry}
      createOrder={createOrder}
      onApprove={onApprove}
      onRetry={() => setRetry((value) => value + 1)}
    />
  );
};

function CardFieldsSession({
  createOrder,
  onApprove,
  onRetry,
}: Omit<MyPayPalCardFieldInterface, 'mode'> & { onRetry: () => void }) {
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const { onPaymentError } = useContext(CheckoutPaymentReviewContext);
  const onReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    if (ready) return;
    const timeout = window.setTimeout(() => setSlow(true), 12000);
    return () => window.clearTimeout(timeout);
  }, [ready]);
  return (
    <section className='relative min-w-0' aria-busy={!ready}>
      {!ready && !slow && <PayPalLoadingSkeleton mode='card' />}
      {!ready && slow && (
        <div
          role='status'
          className='rounded-xl border border-amber-200/30 p-3 text-sm leading-6 text-amber-100'
        >
          <p>The card form isn’t available right now. Choose PayPal above, or try again.</p>
          <button
            type='button'
            onClick={onRetry}
            className='mt-3 min-h-11 rounded-lg border border-current px-4 font-semibold'
          >
            Retry card form
          </button>
        </div>
      )}
      <PayPalCardFieldsProvider
        createOrder={createOrder}
        onApprove={onApprove}
        onError={(error: unknown) => {
          console.warn('[checkout] Card payment error', error);
          if (String(error).includes('Failed to create PayPal order')) return;
          onPaymentError(
            'We couldn’t complete this payment. Check the payment status above before trying again.',
          );
        }}
        style={cardFieldStyles}
      >
        <CardPaymentForm onReady={onReady} ready={ready} />
      </PayPalCardFieldsProvider>
    </section>
  );
}

function CardPaymentForm({ onReady, ready }: { onReady: () => void; ready: boolean }) {
  const { cardFieldsForm, fields } = usePayPalCardFields();
  const formReady = ready && Boolean(cardFieldsForm);
  const details = useContext(ServerOrderDetailsContext);
  const delivery = useShopCheckoutStore((state) => state.delivery_address);
  const { review, originalCheckout } = useContext(CheckoutPaymentReviewContext);
  const [sameAsDelivery, setSameAsDelivery] = useState(true);
  const [customAddress, setCustomAddress] = useState<BillingAddressInterface>({
    addressLine1: '',
    addressLine2: '',
    adminArea1: '',
    adminArea2: '',
    countryCode: '',
    postalCode: '',
  });
  const [billingCountry, setBillingCountry] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof BillingAddressInterface, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [slowPayment, setSlowPayment] = useState(false);
  const orderToken = usePayPalIntentStore((state) => state.checkoutAttempt?.orderToken);
  useEffect(() => {
    if (!paying) return;
    // Bank authentication may take time; offer status access without submitting it again.
    const timer = window.setTimeout(() => setSlowPayment(true), 30_000);
    return () => window.clearTimeout(timer);
  }, [paying]);
  const inputId = useId();
  const countryCode =
    originalCheckout?.countryCode ?? details?.countrySupport.country?.country_iso2 ?? '';
  const billingAddress = sameAsDelivery
    ? billingAddressFromDelivery(originalCheckout?.deliveryAddress ?? delivery, countryCode)
    : customAddress;
  useEffect(() => {
    if (cardFieldsForm) onReady();
  }, [cardFieldsForm, onReady]);
  useEffect(() => {
    if (!cardFieldsForm) return;
    const labels = {
      NameField: 'Name on card',
      NumberField: 'Card number',
      ExpiryField: 'Expiry date',
      CVVField: 'Card security code',
    } as const;
    for (const name of Object.keys(labels) as (keyof typeof labels)[]) {
      void fields[name]?.setAttribute('aria-label', labels[name]).catch(() => {});
    }
  }, [cardFieldsForm, fields]);

  const pay = async () => {
    if (paying || !formReady) return;
    setFormError(null);
    const parsed = checkoutBillingAddressSchema.safeParse(billingAddress);
    if (!parsed.success) {
      const nextErrors: typeof errors = {};
      for (const issue of parsed.error.issues)
        nextErrors[issue.path[0] as keyof BillingAddressInterface] ??= issue.message;
      setErrors(nextErrors);
      setFormError('Check the highlighted billing address fields.');
      return;
    }
    setErrors({});
    if (!cardFieldsForm || !review) {
      setFormError('Review your current order details before paying.');
      return;
    }
    setPaying(true);
    setSlowPayment(false);
    try {
      const state = await boundedCheckoutRequest(() => cardFieldsForm.getState());
      if (!state.isFormValid) {
        setFormError('Check your card number, name, expiry date, and security code.');
        return;
      }
      await cardFieldsForm.submit({ billingAddress: parsed.data });
    } catch (error) {
      console.warn('[checkout] Card submission unavailable', error);
      setFormError('We couldn’t finish your payment. Check its status before trying again.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void pay();
      }}
      className={`min-w-0 space-y-5 ${formReady ? '' : 'invisible absolute inset-x-0 top-0 pointer-events-none'}`}
      noValidate
      aria-busy={paying}
      aria-hidden={!formReady}
      inert={!formReady}
    >
      {slowPayment && paying && (
        <p role='status' className='text-sm leading-6 text-amber-100'>
          This payment is taking longer than usual. Complete any bank approval that is still open.
          {orderToken && (
            <>
              {' '}
              You can also{' '}
              <CustomShopLink
                href={`/shop/checkout/confirmation/${encodeURIComponent(orderToken)}`}
                className='font-semibold underline'
              >
                check this payment’s status
              </CustomShopLink>{' '}
              before trying again.
            </>
          )}
        </p>
      )}
      <div className='grid min-w-0 grid-cols-2 gap-4'>
        <div className='col-span-2 min-w-0'>
          <p id={`${inputId}-name-label`} className='mb-2 text-sm'>
            Name on card
          </p>
          <PayPalNameField placeholder='Name on card' className='min-h-12' />
        </div>
        <div className='col-span-2 min-w-0'>
          <p id={`${inputId}-number-label`} className='mb-2 text-sm'>
            Card number
          </p>
          <PayPalNumberField placeholder='Card number' className='min-h-12' />
        </div>
        <div className='min-w-0'>
          <p className='mb-2 text-sm'>Expiry date</p>
          <PayPalExpiryField placeholder='MM / YY' className='min-h-12' />
        </div>
        <div className='min-w-0'>
          <p className='mb-2 text-sm'>Security code</p>
          <PayPalCVVField placeholder='CVV' className='min-h-12' />
        </div>
      </div>
      <fieldset
        disabled={!formReady || paying}
        className='min-w-0 space-y-4 border-t border-white/20 pt-4'
      >
        <legend className='px-1 text-sm font-semibold'>Billing address</legend>
        <label className='flex min-h-11 items-start gap-3 text-sm leading-6'>
          <input
            type='checkbox'
            checked={sameAsDelivery}
            onChange={(event) => {
              setSameAsDelivery(event.target.checked);
              setErrors({});
            }}
            className='mt-1 h-5 w-5 shrink-0 accent-[#0085ff]'
          />
          <span>Same as delivery address</span>
        </label>
        {!sameAsDelivery && (
          <div className='grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2'>
            {billingFields.map(({ name, label, autoComplete }) => (
              <div
                key={name}
                className={`min-w-0 ${name.startsWith('addressLine') ? 'sm:col-span-2' : ''}`}
              >
                <label htmlFor={`${inputId}-${name}`} className='mb-2 block text-sm'>
                  {label}
                </label>
                <Input
                  id={`${inputId}-${name}`}
                  name={`billing-${name}`}
                  value={customAddress[name] ?? ''}
                  onChange={(event) =>
                    setCustomAddress((current) => ({ ...current, [name]: event.target.value }))
                  }
                  autoComplete={autoComplete}
                  aria-invalid={Boolean(errors[name])}
                  aria-describedby={errors[name] ? `${inputId}-${name}-error` : undefined}
                  className='min-h-11 min-w-0 rounded-xl border-white/35 bg-transparent text-base'
                />
                {errors[name] && (
                  <p id={`${inputId}-${name}-error`} className='mt-1 text-xs text-rose-300'>
                    {errors[name]}
                  </p>
                )}
              </div>
            ))}
            <div className='min-w-0'>
              <label htmlFor={`${inputId}-country`} className='mb-2 block text-sm'>
                Billing country
              </label>
              <CountryDropdown
                id={`${inputId}-country`}
                value={billingCountry}
                aria-label='Billing country'
                aria-invalid={Boolean(errors.countryCode)}
                aria-describedby={errors.countryCode ? `${inputId}-country-error` : undefined}
                onChange={(country) => {
                  setBillingCountry(country.alpha3);
                  setCustomAddress((current) => ({ ...current, countryCode: country.alpha2 }));
                }}
                classNames={{ trigger: 'min-h-11 rounded-xl border-white/35 text-base' }}
              />
              {errors.countryCode && (
                <p id={`${inputId}-country-error`} className='mt-1 text-xs text-rose-300'>
                  {errors.countryCode}
                </p>
              )}
            </div>
          </div>
        )}
      </fieldset>
      {formError && (
        <p
          role='alert'
          className='rounded-xl border border-amber-200/30 p-3 text-sm text-amber-100'
        >
          {formError}
        </p>
      )}
      <button
        type='submit'
        disabled={!formReady || paying || !review}
        className='inline-flex min-h-12 w-full items-center justify-center gap-2 whitespace-normal rounded-xl bg-[#0085ff] px-4 font-semibold text-white hover:bg-[#0085ff]/85 disabled:cursor-not-allowed disabled:opacity-50'
      >
        {paying ? (
          <>
            <Loader2 size={18} className='animate-spin' aria-hidden='true' /> Processing payment…
          </>
        ) : (
          `Pay ${review ? `${formatOrderMoney(review.quote.total, review.quote.currency)} ${review.quote.currency}` : 'with card'}`
        )}
      </button>
    </form>
  );
}

export default MyPayPalCardFields;

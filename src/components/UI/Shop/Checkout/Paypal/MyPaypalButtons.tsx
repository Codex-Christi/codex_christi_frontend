import { PayPalButtons } from '@paypal/react-paypal-js';
import type { FC } from 'react';
import { useContext } from 'react';
import type { MyPayPalCardFieldInterface } from './MyPaypalCardFields';
import { CheckoutPaymentReviewContext } from '../PaymentSection';

const MyPaypalButtons: FC<MyPayPalCardFieldInterface & { onCancel?: () => void }> = ({
  mode,
  createOrder,
  onApprove,
  onCancel,
}) => {
  const { onPaymentError } = useContext(CheckoutPaymentReviewContext);
  if (mode !== 'paypal_buttons') return null;
  return (
    <section aria-label='Pay with PayPal' className='w-full min-w-0'>
      <PayPalButtons
        createOrder={createOrder}
        onApprove={onApprove}
        onCancel={onCancel}
        onError={(error) => {
          console.warn('[checkout] PayPal button unavailable', error);
          if (String(error).includes('Failed to create PayPal order')) return;
          onPaymentError('We couldn’t open PayPal. Check your connection and try again.');
        }}
        style={{
          layout: 'vertical',
          color: 'blue',
          shape: 'pill',
          label: 'pay',
          height: 48,
          tagline: false,
        }}
      >
        <p
          role='status'
          className='rounded-xl border border-amber-200/30 p-3 text-sm leading-6 text-amber-100'
        >
          PayPal isn’t available here right now. Choose credit / debit card above, or try again
          later.
        </p>
      </PayPalButtons>
    </section>
  );
};

export default MyPaypalButtons;

import errorToast from '@/lib/error-toast';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { MyPayPalCardFieldInterface } from './MyPaypalCardFields';
import { FC, useState } from 'react';
import PayPalLoadingSkeleton from './PayPalLoadingSkeleton';

const MyPaypalButtons: FC<
  Omit<MyPayPalCardFieldInterface, 'billingAddress' | 'handleBillingAddressChange'>
> = (props) => {
  // Props
  const { mode, createOrder, onApprove } = props;

  const [isReady, setIsReady] = useState(false);

  if (mode !== 'paypal_buttons') return null;

  // Main JSX
  return (
    <section className='w-full !mx-auto'>
      {!isReady ? <PayPalLoadingSkeleton mode='paypal_buttons' /> : null}
      <PayPalButtons
        createOrder={createOrder}
        onApprove={onApprove}
        onInit={() => setIsReady(true)}
        onError={(err) => {
          console.error(String(err));
          errorToast({ message: String(err) });
        }}
        className={isReady ? '' : 'opacity-0 pointer-events-none'}
        style={{
          layout: 'horizontal',
          color: 'blue',
          shape: 'pill',
          label: 'pay',
          height: 40,
          tagline: false,
        }}
      />
    </section>
  );
};

export default MyPaypalButtons;

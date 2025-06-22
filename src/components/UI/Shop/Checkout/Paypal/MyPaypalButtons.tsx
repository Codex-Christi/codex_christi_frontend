import errorToast from '@/lib/error-toast';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { MyPayPalCardFieldInterface } from './MyPaypalCardFields';
import { FC } from 'react';

const MyPaypalButtons: FC<
  Omit<
    MyPayPalCardFieldInterface,
    'billingAddress' | 'handleBillingAddressChange'
  >
> = (props) => {
  // Props
  const { mode, createOrder, onApprove } = props;

  // Main JSX
  return (
    <section
      className={`${mode === 'paypal_buttons' ? 'block' : 'hidden'} w-full !mx-auto`}
    >
      <PayPalButtons
        createOrder={() => createOrder(false)}
        onApprove={onApprove}
        onError={(err) => {
          console.error(String(err));
          errorToast({ message: String(err) });
        }}
        style={{
          layout: 'horizontal',
          color: 'blue',
          shape: 'pill',
          label: 'pay',
          height: 40,
        }}
      />
    </section>
  );
};

export default MyPaypalButtons;

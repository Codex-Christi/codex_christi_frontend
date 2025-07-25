import errorToast from '@/lib/error-toast';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { MyPayPalCardFieldInterface } from './MyPaypalCardFields';
import { FC } from 'react';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';

const MyPaypalButtons: FC<
  Omit<
    MyPayPalCardFieldInterface,
    'billingAddress' | 'handleBillingAddressChange'
  >
> = (props) => {
  // Props
  const { mode, createOrder, onApprove } = props;

  // Hooks
  const country = useShopCheckoutStore(
    (state) => state.delivery_address.shipping_country
  );

  if (mode !== 'paypal_buttons' && !country) return null;

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
          tagline: false,
        }}
      />
    </section>
  );
};

export default MyPaypalButtons;

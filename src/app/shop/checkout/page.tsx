import CheckoutPage from '@/components/UI/Shop/ProductCheckout';
import { Metadata } from 'next';
import PayPalCheckout from '@/components/UI/Shop/Checkout/Paypal/PaypalMainComponent';

export const metadata: Metadata = {
  title: 'Checkout | Codex Christi',
  description: 'Complete your checkout for your purchase',
};

const Checkout = () => {
  return (
    <>
      <CheckoutPage />
      <PayPalCheckout />
    </>
  );
};

export default Checkout;

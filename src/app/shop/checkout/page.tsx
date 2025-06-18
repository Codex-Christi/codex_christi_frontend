import CheckoutPage from '@/components/UI/Shop/Checkout/ProductCheckout';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Checkout | Codex Christi',
  description: 'Complete your checkout for your purchase',
};

const Checkout = () => {
  return (
    <>
      <CheckoutPage />
    </>
  );
};

export default Checkout;

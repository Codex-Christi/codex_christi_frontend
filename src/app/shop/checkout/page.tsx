import CheckoutPage from '@/components/UI/Shop/Checkout/ProductCheckout';
import { isNewCheckoutPaused } from '@/lib/shop/checkout/checkoutIntakePolicy';
import type { Metadata } from 'next';
import { connection } from 'next/server';

export const metadata: Metadata = {
  title: 'Checkout | Codex Christi',
  description: 'Complete your checkout for your purchase',
};

export default async function Checkout() {
  await connection();
  return <CheckoutPage checkoutPaused={isNewCheckoutPaused()} />;
}

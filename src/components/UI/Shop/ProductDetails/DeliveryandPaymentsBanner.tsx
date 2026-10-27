import { ArrowUpRight, CreditCard, Truck } from 'lucide-react';
import CustomShopLink from '@/components/UI/Shop/HelperComponents/CustomShopLink';
import styles from './ProductDetails.module.css';

export const DeliveryandPaymentsBanner = () => (
  <div className={`${styles.productPanel} ${styles.spaceLarge}`}>
    <section className='space-y-2'>
      <h2 className='flex items-center gap-2 text-2xl font-bold'>
        <Truck size={21} aria-hidden='true' />
        Delivery
      </h2>
      <p>Shipping availability and costs depend on the selected options and delivery address.</p>
    </section>

    <section className='space-y-2'>
      <h2 className='flex items-center gap-2 text-2xl font-bold'>
        <CreditCard size={21} aria-hidden='true' />
        Payments
      </h2>
      <p>Payments are processed through PayPal. Payment options are shown at checkout.</p>
    </section>

    <CustomShopLink
      href='/shop/shipping-pod-policy'
      className='inline-flex items-center gap-2 underline underline-offset-4'
    >
      Shipping and made-to-order policy
      <ArrowUpRight size={18} className='shrink-0' aria-hidden='true' />
    </CustomShopLink>
  </div>
);

import CustomShopLink from '../HelperComponents/CustomShopLink';
import { checkoutPanelClassName } from './checkoutStyles';

export default function CheckoutPausedNotice() {
  return (
    <section className={`${checkoutPanelClassName} min-w-0 p-5 sm:p-6`}>
      <h2 className='text-lg font-semibold'>New checkouts are paused</h2>
      <p className='mt-2 text-sm leading-6 text-white/75'>
        Your cart is still here. If you already placed an order, use your confirmation link or
        check Order History.
      </p>
      <CustomShopLink
        href='/shop/account-overview/order-history'
        className='mt-2 inline-flex min-h-11 items-center text-sm font-semibold underline'
      >
        View order history
      </CustomShopLink>
    </section>
  );
}

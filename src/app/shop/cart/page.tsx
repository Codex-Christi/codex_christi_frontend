import Link from 'next/link';
import { Metadata } from 'next';
import CartMainComponent from '@/components/UI/Shop/Cart/CartMainComponent';

export const metadata: Metadata = {
  title: 'Cart | Codex Christi Shop',
  description: 'View and modify products in your cart',
};

const Cart = () => {
  // JSX
  return (
    <div className='pb-12'>
      <CartMainComponent />

      <div className='space-y-8 mt-4 md:col-span-2'>
        <div className='grid place-content-center gap-4'>
          <p>Please tell us what you think.</p>

          <Link
            className='text-center bg-[#0085FF] px-4 py-3 rounded-lg text-white'
            href=''
          >
            Kindly give us a feedback!
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Cart;

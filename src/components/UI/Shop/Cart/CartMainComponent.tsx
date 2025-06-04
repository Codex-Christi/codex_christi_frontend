'use client';

import { useCartStore } from '@/stores/shop_stores/cartStore';
import { useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import CartItems from './CartItems';

const CartEmptyComponent = dynamic(
  () => import('./CartEmptyComponent').then((mod) => mod.CartEmptyComponent),
  {
    ssr: false,
  }
);

// Main component
const CartMainComponent = () => {
  // Hooks
  // Hooks
  const { variants } = useCartStore((state) => state);
  const isCartEmpty = useMemo(() => variants.length === 0, [variants.length]);

  useEffect(() => {
    if (!isCartEmpty) {
      console.log(variants);
    }
  }, [isCartEmpty, variants]);

  // JSX
  return (
    <div className='px-2 py-12 md:px-[20px] lg:px-[24px] mx-auto'>
      <h2 className='font-extrabold text-white text-4xl font-ocr my-5 mx-5'>
        Your Cart
      </h2>
      <div
        className='bg-[#3D3D3D4D] backdrop-blur-[5px] text-white rounded-[20px] 
          grid gap-4 min-h-[60svh] w-full sm:w-[95vw] mx-auto
          md:!w-[90vw] lg:!w-[85vw] maz-w-[1200px] py-12'
      >
        {isCartEmpty && <CartEmptyComponent />}

        {/* If the cart is not empty, render the cart items */}
        {!isCartEmpty && variants && (
          <div className='flex flex-col gap-8 max-h-[90vh] px-5 overflow-y-auto scrollbar'>
            {/* All Cart Items */}
            <CartItems cartItems={variants} />
          </div>
        )}
      </div>
    </div>
  );
};

export default CartMainComponent;

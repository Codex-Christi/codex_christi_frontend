'use client';

import { useCartStore } from '@/stores/shop_stores/cartStore';
import { useMemo } from 'react';
import dynamic from 'next/dynamic';

// Dynamic Imports
const CartEmptyComponent = dynamic(
  () => import('./CartEmptyComponent').then((mod) => mod.CartEmptyComponent),
  {
    ssr: false,
  }
);
const CartItems = dynamic(
  () => import('./CartItems').then((mod) => mod.default),
  {
    ssr: false,
  }
);
const OrderSummary = dynamic(
  () => import('./OrderSummary').then((mod) => mod.default),
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

  // JSX
  return (
    <div
      className='px-2 py-4 md:px-[20px] lg:px-[24px] mx-auto mt-5 flex
    flex-col lg:flex-row gap-6 xl:gap-10'
    >
      {/* Container for cart contents */}
      <div
        className='bg-[#3D3D3D4D] backdrop-blur-[5px] text-white rounded-[20px] 
          min-h-[20svh] w-full sm:w-[85vw] md:w-[80vw] mx-auto lg:!w-[90vw] xl:!w-[85vw] py-8
          justify-center'
      >
        {/* Cart Title */}
        <h1 className=' font-light text-white text-4xl font-ocr text-left mb-4 pl-5'>
          Your Cart{' '}
          {!isCartEmpty
            ? `(${variants.length} item${variants.length > 1 ? 's' : ''})`
            : ''}
        </h1>

        {isCartEmpty && <CartEmptyComponent />}

        {/* If the cart is not empty, render the cart items */}
        {!isCartEmpty && variants && (
          <div className='flex flex-col gap-8 max-h-[90vh] px-5 overflow-y-auto scrollbar'>
            {/* All Cart Items */}
            <CartItems cartItems={variants.reverse()} />
          </div>
        )}
      </div>

      {/* Conatiner for Order Summary */}
      {!isCartEmpty && variants && <OrderSummary />}
    </div>
  );
};

export default CartMainComponent;

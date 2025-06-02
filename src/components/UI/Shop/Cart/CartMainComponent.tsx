'use client';

import { useCartStore } from '@/stores/shop_stores/cartStore';
import { useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';

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
    <div className='px-2 py-12 md:px-[20px] lg:px-[24px]'>
      <h2 className='font-extrabold text-white text-4xl font-ocr'>Your Cart</h2>
      <div className='bg-[#3D3D3D4D] text-white rounded-[20px] grid place-content-center gap-4 min-h-[60svh] w-full py-12'>
        {isCartEmpty && <CartEmptyComponent />}

        {/* If the cart is not empty, render the cart items */}
        {!isCartEmpty && variants && (
          <div className='grid gap-8'>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {variants.map(({ itemDetail: variant }) => (
                <div
                  key={variant._id}
                  className='bg-[#4C3D3D3D] backdrop-blur-[10px] p-4 rounded-[20px]'
                >
                  {/* Render variant details here */}
                  <h3 className='font-bold text-xl'>{variant.title}</h3>
                  <p>{`Price: $${variant.retail_price}`}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartMainComponent;

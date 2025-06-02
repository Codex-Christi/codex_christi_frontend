'use client';

import { useCartStore } from '@/stores/shop_stores/cartStore';
import { useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';

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
            {variants.map(({ itemDetail: variant, title }) => {
              const productTitle = title;
              const { title: variantTitle, image, retail_price, _id } = variant;

              return (
                <div
                  key={_id}
                  className='bg-gray-700 bg-opacity-80 p-4 rounded-lg shadow-sm 
                   shadow-gray-200 w-full md:w-[600px] flex lg:w-[800px] mx-auto
                   justify-between'
                >
                  {/* Render variant details here */}
                  {image && (
                    <Image
                      src={image}
                      className='rounded-lg'
                      width={100}
                      height={100}
                      alt={title}
                    />
                  )}
                  <section>
                    <h3 className='font-bold text-xl'>{productTitle}</h3>
                    <p>{`Price: $${retail_price}`}</p>
                  </section>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CartMainComponent;

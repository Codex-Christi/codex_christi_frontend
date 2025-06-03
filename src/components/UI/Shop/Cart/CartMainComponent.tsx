'use client';

import { useCartStore } from '@/stores/shop_stores/cartStore';
import { useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import {
  hasColorAndSize,
  ProductVariantOptions,
} from '@/app/shop/product/[id]/productDetailsSSR';

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
      <div className='bg-[#3D3D3D4D] backdrop-blur-[5px] text-white rounded-[20px] grid place-content-center gap-4 min-h-[60svh] w-full py-12'>
        {isCartEmpty && <CartEmptyComponent />}

        {/* If the cart is not empty, render the cart items */}
        {!isCartEmpty && variants && (
          <div
            className='flex flex-col gap-8 max-h-[90vh] px-5 !w-full 
          md:!w-[90vw] lg:!w-[85vw] maz-w-[1200px] overflow-y-auto scrollbar'
          >
            {variants.map(({ itemDetail: variant, title, quantity }) => {
              const productTitle = title;
              const {
                title: variantTitle,
                image,
                retail_price,
                _id,
                options,
              } = variant;
              const isSizeAndColor = hasColorAndSize(
                options as ProductVariantOptions
              );

              return (
                <div
                  key={_id}
                  className='bg-gray-700 bg-opacity-80 p-4 rounded-lg shadow-sm 
                   shadow-gray-200 w-full flex mx-auto justify-between'
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

                  {/* Title , price and quantity */}
                  <section className='font-semibold text-left h-full flex flex-col justify-between'>
                    <h3 className='text-xl'>{productTitle}</h3>
                    <h4>{`Price: $${retail_price} (each)`}</h4>
                    <h4>{`Quantity: ${quantity}`}</h4>
                  </section>

                  {/* Size and Color */}
                  <section
                    className='font-semibold !text-left h-full flex flex-col justify-center 
                  !items-start'
                  >
                    {isSizeAndColor && <h4>Color:{options[2]?.name}</h4>}
                    <h4>
                      Size:{' '}
                      {isSizeAndColor
                        ? options[1]?.value.toUpperCase()
                        : options[0].value.toUpperCase()}
                    </h4>
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

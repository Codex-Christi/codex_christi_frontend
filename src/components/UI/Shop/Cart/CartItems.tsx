import { ProductVariantOptions } from '@/app/shop/product/[id]/productDetailsSSR';
import { CartVariant } from '@/stores/shop_stores/cartStore';
import React, { FC } from 'react';
import Image from 'next/image';
import SizeAndColorElem from './SizeAndColor';
import { ItemQuantityComponent } from './ItemQuantityComponent';
import Link from 'next/link';

// Car Items Component
const CartItems: FC<{ cartItems: CartVariant[] }> = ({ cartItems }) => {
  {
    return cartItems.map((cartItem) => {
      const { itemDetail: variant, title, slug, quantity } = cartItem;
      const productTitle = title;
      const { image, retail_price, _id, options } = variant;

      return (
        <div
          key={_id}
          className='bg-gray-700 bg-opacity-80 p-4 rounded-lg shadow-sm 
             shadow-gray-200 w-full mx-auto items-center grid justify-between
             grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 '
        >
          {/* Render variant details here */}

          {/* Item Image */}
          {image && (
            <Link href={`/shop/product/${slug}`}>
              <Image
                src={image}
                className='rounded-xl hover:cursor-pointer'
                width={100}
                height={100}
                alt={title}
              />
            </Link>
          )}

          {/* Title , price */}
          <section
            className='text-left h-full flex flex-col justify-around col-span-1 
          md:col-span-2 lg:col-span-3 hover:cursor-pointer'
          >
            <Link href={`/shop/product/${slug}`}>
              <h3 className='text-lg font-semibold font-ocr '>
                {productTitle}
              </h3>
            </Link>

            <h4>{`Price: $${retail_price} (each)`}</h4>
          </section>

          {/* Size and Color, and Quantity */}
          <section
            className='items-start md:items-center h-full flex flex-col justify-around 
            '
          >
            {/*  Size & Color*/}
            <SizeAndColorElem
              options={options as ProductVariantOptions}
              className=''
            />
            {/* Quantity */}
            <ItemQuantityComponent
              className='hidden md:flex'
              cartItem={cartItem}
            />
          </section>

          {/* Quantity on small screens only */}
          <ItemQuantityComponent
            className='flex md:hidden'
            cartItem={cartItem}
          />
          {/* Delete Item */}
          {/* <Button></Button> */}

          {/* Total */}
          <h3 className='text-[1.2rem] font-semibold self-end text-right'>
            Total: ${retail_price * quantity}
          </h3>
        </div>
      );
    });
  }
};

export default CartItems;

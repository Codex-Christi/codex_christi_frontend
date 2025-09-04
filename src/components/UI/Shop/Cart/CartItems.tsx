import { ProductVariantOptions } from '@/app/shop/product/[id]/productDetailsSSR';
import { CartVariant } from '@/stores/shop_stores/cartStore';
import React, { FC } from 'react';
import Image from 'next/image';
import SizeAndColorElem from './SizeAndColor';
import { ItemQuantityComponent } from './ItemQuantityComponent';
import CustomShopLink from '@/components/UI/Shop/HelperComponents/CustomShopLink';

// Car Items Component
const CartItems: FC<{ cartItems: CartVariant[] }> = ({ cartItems }) => {
  {
    return (
      cartItems
        // .slice()
        // .toReversed()
        .map((cartItem) => {
          const { itemDetail: variant, title, quantity } = cartItem;
          const productTitle = title;
          const { image, retail_price, _id, options, product: parentID } = variant;

          return (
            <div
              key={_id}
              className='bg-transparent px-0 md:px-4 py-4 rounded-l w-full mx-auto items-center 
          grid justify-evenly grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 select-none'
            >
              {/* Render variant details here */}

              {/* Item Image */}
              {image && (
                <CustomShopLink href={`/shop/product/${parentID}`}>
                  <Image
                    src={image}
                    className='rounded-xl hover:cursor-pointer'
                    width={90}
                    height={90}
                    alt={title}
                  />
                </CustomShopLink>
              )}

              {/* Title , price */}
              <section
                className='text-left h-full flex flex-col justify-around col-span-1 
          md:col-span-2 xl:col-span-3 hover:cursor-pointer'
              >
                <CustomShopLink href={`/shop/product/${parentID}`}>
                  <h3 className='text-lg font-semibold hover:underline underline-offset-8 '>
                    {productTitle}
                  </h3>
                </CustomShopLink>

                <h4>{`Price: $${retail_price} (each)`}</h4>
              </section>

              {/* Size and Color, and Quantity */}
              <section
                className='items-start md:items-center h-full flex flex-col justify-around 
            gap-2'
              >
                {/*  Size & Color*/}
                <SizeAndColorElem options={options as ProductVariantOptions} className='' />
                {/* Quantity */}
                <ItemQuantityComponent className='hidden md:flex' cartItem={cartItem} />
              </section>

              {/* Quantity on small screens only */}
              <ItemQuantityComponent className='flex md:hidden' cartItem={cartItem} />
              {/* Delete Item */}
              {/* <Button></Button> */}

              {/* Total */}
              <h3
                className='text-[1.2rem] font-semibold self-end text-right
          col-span-2 md:col-span-4 xl:col-span-1 py-4 lg:py-0'
              >
                Total: ${retail_price * quantity}
              </h3>
            </div>
          );
        })
    );
  }
};

export default CartItems;

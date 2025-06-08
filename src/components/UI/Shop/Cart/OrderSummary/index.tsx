'use client';

import { getCatalogItems } from '@/actions/merchize/getItemCatalogInfo';
import { Button } from '@/components/UI/primitives/button';
import { CatalogItem } from '@/lib/datasetSearchers/merchize/catalog';
import { useCartStore } from '@/stores/shop_stores/cartStore';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Gets the max and min shipping fee for an order (cart instance)
 */
const getMaxandMinShippingPrice = (
  catalogData: CatalogItem[],
  findValue: 'max' | 'min'
) => {
  const comparator = findValue === 'max' ? Math.max : Math.min;
  return catalogData.reduce((accum, current) => {
    const {
      EU_additional_shipping_fee,
      ROW_additional_shipping_fee,
      EU_shipping_fee,
      ROW_shipping_fee,
      US_additional_shipping_fee,
      US_shipping_fee,
    } = current;
    const newObj = {
      EU_additional_shipping_fee,
      ROW_additional_shipping_fee,
      EU_shipping_fee,
      ROW_shipping_fee,
      US_additional_shipping_fee,
      US_shipping_fee,
    };
    return (
      comparator(
        ...Object.values(newObj).filter(
          (v): v is number => typeof v === 'number'
        )
      ) + accum
    );
  }, 0);
};

// Main Component
const OrderSummary: FC = () => {
  // Hooks
  const { variants: cartItems } = useCartStore();
  const subTotal = useMemo(
    () =>
      cartItems.reduce((acc, item) => {
        return acc + item.itemDetail.retail_price;
      }, 0),
    [cartItems]
  );
  const [shippingEstimates, setShippingEstimates] = useState<{
    min: number;
    max: number;
  } | null>(null);

  //   Funcs
  const getShippingEstimates = useCallback(async () => {
    const filt = cartItems.map(({ itemDetail }) => {
      return itemDetail.sku;
    });
    if (filt) {
      const skuCatalogData = await getCatalogItems(
        filt
          ? filt.filter((sku): sku is string => typeof sku === 'string')
          : ['']
      );

      const minShippingFee = getMaxandMinShippingPrice(skuCatalogData, 'min');
      const maxShippingFee = getMaxandMinShippingPrice(skuCatalogData, 'max');

      return { min: minShippingFee, max: maxShippingFee };
    }
  }, [cartItems]);

  //   UseEffects
  useEffect(() => {
    async function fetchShippingEstimates() {
      const shippingEstimates = await getShippingEstimates();
      if (shippingEstimates) {
        setShippingEstimates(shippingEstimates);
      }
    }
    fetchShippingEstimates();
  }, [getShippingEstimates]);

  // JSX
  return (
    <section
      className='bg-[#3D3D3D4D] backdrop-blur-[5px] text-white rounded-[20px] 
     w-full sm:w-[85vw] md:w-[80vw] lg:!w-[35%] xl:!w-[32.5%] py-8 lg:self-start mx-auto
     px-5 flex flex-col'
    >
      {/* Header */}
      <h1
        className=' font-light text-white text-4xl font-ocr text-left mb-4
      underline underline-offset-[1.5rem] lg:no-underline xl:underline select-none'
      >
        Order Summary
      </h1>

      <h3 className='pt-12 font-normal flex text-xl justify-between'>
        <span>Subtotal </span>
        <span>${subTotal}</span>
      </h3>

      <Button
        className={`w-[95%] text-center !mx-auto py-8 text-xl mt-10 rounded-3xl 
            bg-white text-black hover:bg-gray-200`}
        name='Checkout Button'
      >
        Proceed to Checkout
      </Button>
    </section>
  );
};

export default OrderSummary;

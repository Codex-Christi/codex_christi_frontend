'use client';

import { getCatalogItems } from '@/actions/merchize/getItemCatalogInfo';
import { CatalogItem } from '@/lib/datasetSearchers/merchize/catalog';
import { useCartStore } from '@/stores/shop_stores/cartStore';
import Link from 'next/link';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { FaAngleRight } from 'react-icons/fa6';
import CustomShopLink from '../../HelperComponents/CustomShopLink';

/**
 * Gets the max and min shipping fee for an order (cart instance)
 */
const getMaxandMinShippingPrice = (catalogData: CatalogItem[], findValue: 'max' | 'min') => {
  const comparator = findValue === 'max' ? Math.max : Math.min;
  let sku = '';

  //   Reducer
  return catalogData.reduce((accum, current) => {
    const {
      EU_additional_shipping_fee,
      ROW_additional_shipping_fee,
      EU_shipping_fee,
      ROW_shipping_fee,
      US_additional_shipping_fee,
      US_shipping_fee,
      SKU_variant,
    } = current;

    // new object
    const passInObj =
      sku === SKU_variant
        ? {
            EU_additional_shipping_fee,
            ROW_additional_shipping_fee,
            US_additional_shipping_fee,
          }
        : {
            EU_shipping_fee,
            ROW_shipping_fee,
            US_shipping_fee,
          };

    sku = SKU_variant;

    return (
      comparator(
        ...Object.values(passInObj).filter((v): v is number => typeof v === 'number' && v > 0),
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
      cartItems.reduce((acc, { itemDetail: { retail_price }, quantity }) => {
        return acc + retail_price * quantity;
      }, 0),
    [cartItems],
  );
  const [shippingEstimates, setShippingEstimates] = useState<{
    min: number;
    max: number;
  } | null>(null);

  //   Funcs
  const getShippingEstimates = useCallback(async () => {
    const filt = cartItems.flatMap(({ itemDetail, quantity }) => {
      return Array(quantity).fill(itemDetail.sku);
    });
    if (filt) {
      const skuCatalogData = await getCatalogItems(
        filt ? filt.filter((sku): sku is string => typeof sku === 'string') : [''],
      );

      const minShippingFee = getMaxandMinShippingPrice(skuCatalogData, 'min');
      const maxShippingFee = getMaxandMinShippingPrice(skuCatalogData, 'max');

      return { min: Math.ceil(minShippingFee), max: Math.ceil(maxShippingFee) };
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
     px-5 flex flex-col select-none'
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

      {shippingEstimates && (
        <>
          <h3 className='pt-2 font-normal flex text-xl justify-between'>
            <span>
              Shipping Fee <span className='font-extrabold'>**</span>
            </span>
            <span>
              ${shippingEstimates.min} -${shippingEstimates.max}
            </span>
          </h3>

          <p className='font-semibold pt-8'>
            <span className='font-extrabold'>**</span> &nbsp; Shipping fee varies by location.{' '}
            <br />
            <Link
              className='font-normal text-blue-200 underline underline-offset-2'
              href='/shop/help/shipping-rates-and-supported-countries'
              target='_blank'
            >
              Learn more
            </Link>
          </p>
        </>
      )}

      <CustomShopLink
        href='/shop/checkout'
        className={`w-[95%] text-center !mx-auto py-4 px-4 text-xl mt-10 rounded-3xl 
            bg-white text-black hover:bg-gray-200  gap-2 !flex justify-center items-center`}
        // name='Checkout Button'
      >
        <h4>Proceed to Checkout</h4> <FaAngleRight size={22.5} />
      </CustomShopLink>
    </section>
  );
};

export default OrderSummary;

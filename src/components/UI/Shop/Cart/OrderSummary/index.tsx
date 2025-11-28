'use client';

import { getCatalogItems } from '@/actions/merchize/getItemCatalogInfo';
import { CatalogItem } from '@/lib/datasetSearchers/merchize/shipping.types';
import { useCartStore } from '@/stores/shop_stores/cartStore';
import Link from 'next/link';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { FaAngleRight } from 'react-icons/fa6';
import CustomShopLink from '../../HelperComponents/CustomShopLink';
import { iso3ToDest } from '@/lib/datasetSearchers/merchize/dest-map';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import GlobalProductPrice from '../../GlobalShopComponents/GlobalProductPrice';

type OrderSummaryProps = {
  /** ISO-3 destination country code, e.g. 'USA', 'GBR', 'CAN'. Defaults to 'USA'. */
  countryIso3?: string;
};

/**
 * Gets the max or min shipping fee for an order (cart instance) for a given region.
 *
 * NOTE: This uses the same US/EU/ROW shipping band fields as the legacy catalog.
 * For GB/CA/AU/etc we map them to the closest band (ROW) at the call site.
 */
const getMaxandMinShippingPrice = (
  catalogData: CatalogItem[],
  findValue: 'max' | 'min',
  region: 'US' | 'EU' | 'ROW',
) => {
  const comparator = findValue === 'max' ? Math.max : Math.min;
  let sku = '';

  const baseKey = `${region}_shipping_fee` as keyof CatalogItem;
  const addlKey = `${region}_additional_shipping_fee` as keyof CatalogItem;

  return catalogData.reduce((accum, current) => {
    const { SKU_variant } = current;

    // For repeated SKUs, we use the additional-item band; otherwise the first-item band.
    const values = sku === SKU_variant ? [current[addlKey]] : [current[baseKey]];

    sku = SKU_variant;

    const numericVals = values.filter((v): v is number => typeof v === 'number' && v > 0);

    if (!numericVals.length) return accum;

    const segment = comparator(...numericVals);

    // Preserve original behavior: accumulate per-SKU segment rather than global min/max.
    return segment + accum;
  }, 0);
};

// Main Component
const OrderSummary: FC<OrderSummaryProps> = ({ countryIso3 = 'USA' }) => {
  // Hooks
  const { variants: cartItems } = useCartStore();
  const country = useShopCheckoutStore((state) => state.delivery_address.shipping_country);

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
    // Expand cart by quantity → ['SKU1', 'SKU1', 'SKU2', ...]
    const skus = cartItems
      .flatMap(({ itemDetail, quantity }) => Array.from({ length: quantity }, () => itemDetail.sku))
      .filter((sku): sku is string => typeof sku === 'string' && !!sku);

    if (!skus.length) return null;

    try {
      const skuCatalogData = await getCatalogItems(skus);

      // Map ISO-3 country code to shipping destination band
      const dest = iso3ToDest((country ?? countryIso3).toUpperCase());
      // Our legacy catalog only has US/EU/ROW fields. Everything else falls back to ROW.
      const region: 'US' | 'EU' | 'ROW' = dest === 'US' ? 'US' : dest === 'EU' ? 'EU' : 'ROW';

      const minShippingFee = getMaxandMinShippingPrice(skuCatalogData, 'min', region);
      const maxShippingFee = getMaxandMinShippingPrice(skuCatalogData, 'max', region);

      return {
        min: Math.ceil(minShippingFee),
        max: Math.ceil(maxShippingFee),
      };
    } catch (error) {
      console.error('[OrderSummary] Failed to fetch shipping estimates:', error);
      return null;
    }
  }, [cartItems, country, countryIso3]);

  //   UseEffects
  useEffect(() => {
    async function fetchShippingEstimates() {
      const estimates = await getShippingEstimates();
      if (estimates) {
        setShippingEstimates(estimates);
      } else {
        setShippingEstimates(null);
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

      <h3 className='pt-12 font-semibold flex text-xl justify-between'>
        <span>Subtotal </span>
        <GlobalProductPrice usdAmount={subTotal}></GlobalProductPrice>
      </h3>

      {shippingEstimates && (
        <>
          <h3 className='pt-2 font-semibold flex text-lg justify-between'>
            <span>
              Shipping Fee <span className='font-extrabold'>**</span>
            </span>
            <section>
              <GlobalProductPrice className='px-0' usdAmount={shippingEstimates.min} /> -{' '}
              <GlobalProductPrice className='px-0' usdAmount={shippingEstimates.max} />
            </section>
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

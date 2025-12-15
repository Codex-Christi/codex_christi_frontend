'use client';

import { useContext, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { ServerOrderDetailsContext } from './ServerOrderDetailsComponent';
import { useCartStore } from '@/stores/shop_stores/cartStore';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/UI/primitives/accordion';
import { useResponsiveSSRValue } from '@/lib/hooks/useResponsiveSSR_Store';

const MiniCartList = dynamic(() => import('../Cart/MiniCartList').then((mod) => mod.MiniCartList), {
  ssr: false,
});

const OrderSummary = () => {
  const serverOrderDetails = useContext(ServerOrderDetailsContext);
  const cartItems = useCartStore((state) => state.variants);
  const { isTabletAndAbove } = useResponsiveSSRValue();

  const previewCount = isTabletAndAbove ? 2 : 1;
  const previewItems = useMemo(() => cartItems.slice(0, previewCount), [cartItems, previewCount]);
  const remainingItems = useMemo(() => cartItems.slice(previewCount), [cartItems, previewCount]);
  const hasMoreItems = remainingItems.length > 0;

  const [accordionValue, setAccordionValue] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!hasMoreItems) {
      setAccordionValue(undefined);
    }
  }, [hasMoreItems]);

  const cartCount = cartItems.length;
  const cartPlural = cartCount === 1 ? 'item' : 'items';

  const { retailPriceTotalNum, shippingPriceNum, currency, currency_symbol } =
    serverOrderDetails?.finalPricesWithShippingFee ?? {};

  return (
    <div className='bg-[#4C3D3D3D] backdrop-blur-[10px] p-4 rounded-[10px] md:p-10 space-y-8 lg:col-span-5'>
      <h2 className='border-b border-white pb-1 text-xl font-bold flex items-center justify-between'>
        <span>Order Summary</span>
        <span className='text-sm font-medium text-white/70'>{`${cartCount} ${cartPlural}`}</span>
      </h2>

      <div className='space-y-8'>
        <div className='space-y-4'>
          <MiniCartList
            items={previewItems}
            showQuantityControls={false}
            className='mt-1'
            variant={isTabletAndAbove ? 'default' : 'compact'}
            confirmBeforeRemove
            emptyState={<p className='text-sm text-white/60 pt-2'>Your cart is empty.</p>}
          />

          {hasMoreItems && (
            <Accordion
              type='single'
              collapsible
              value={accordionValue}
              onValueChange={(value) => setAccordionValue(value || undefined)}
              className='rounded-[10px] border border-white/10'
            >
              <AccordionItem value='cart-items' className='border-none px-4'>
                <AccordionTrigger className='text-sm font-semibold text-white/80 hover:text-white py-3 px-0'>
                  View remaining {remainingItems.length} item
                  {remainingItems.length === 1 ? '' : 's'}
                </AccordionTrigger>
                <AccordionContent className='pb-4'>
                  <MiniCartList
                    items={remainingItems}
                    showQuantityControls={false}
                    variant='compact'
                    className='mt-2'
                    confirmBeforeRemove
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>

        <div className='flex items-start gap-3'>
          <input
            className='input w-full !px-4 !py-2.5 !rounded-[10px] !border-[#F3F3F399]'
            type='text'
            placeholder='Coupon or discount code'
            id='coupon'
            name='coupon'
          />

          <button className='btn border-[#F3F3F366] text-[#F3F3F3] bg-[#F3F3F366] hover:bg-[#F3F3F366]/30 hover:text-[#F3F3F3] !font-bold px-4 sm:px-6 !py-2.5 rounded-[10px] text-sm sm:text-base text-center shrink-0'>
            Apply
          </button>
        </div>

        {serverOrderDetails?.finalPricesWithShippingFee && (
          <div className='space-y-2 text-[#F3F3F3]'>
            <p className='flex items-center justify-between gap-4 font-semibold'>
              <span>Subtotal</span>

              <span>{`${currency_symbol} ${retailPriceTotalNum}`}</span>
            </p>

            <p className='flex items-center justify-between gap-4 font-semibold'>
              <span>Shipping/Delivery Fee</span>

              <span>{`${currency_symbol} ${shippingPriceNum}`}</span>
            </p>
          </div>
        )}

        {serverOrderDetails?.finalPricesWithShippingFee && (
          <p className='flex items-center justify-between gap-4 font-semibold text-[#F3F3F3]'>
            <span>Total</span>
            <span className='text-lg'>{`${(
              (retailPriceTotalNum ?? 0) + (shippingPriceNum ?? 0)
            ).toLocaleString()} ${currency}`}</span>
          </p>
        )}
      </div>
    </div>
  );
};

export default OrderSummary;

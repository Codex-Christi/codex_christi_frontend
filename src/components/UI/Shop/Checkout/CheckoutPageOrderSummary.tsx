'use client';

import { useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import { useFadeWhenNearTarget } from '@/lib/hooks/generalHooks/scrollUxHooks';

const MiniCartList = dynamic(() => import('../Cart/MiniCartList').then((mod) => mod.MiniCartList), {
  ssr: false,
});

const OrderSummaryTotals = dynamic(() => import('./OrderSummaryTotals'), { ssr: false });

// Main Component
const OrderSummary = () => {
  const serverOrderDetails = useContext(ServerOrderDetailsContext);
  const cartItems = useCartStore((state) => state.variants);
  const { isTabletAndAbove, isTabletOnly, isMobile } = useResponsiveSSRValue();
  const fixedMiniSummaryTotalsMobileRef = useRef<HTMLDivElement>(null);
  const originalSummaryTotalsRef = useRef<HTMLDivElement>(null);

  const { progress } = useFadeWhenNearTarget({
    sourceRef: fixedMiniSummaryTotalsMobileRef, // kept for API compatibility
    targetRef: originalSummaryTotalsRef, // in-flow full summary wrapper div
    // Start ~10px before it enters from the bottom
    offsetPx: isMobile ? -10 : window && window.innerHeight > 1000 ? 40 : 30,
    // Smooth ramp: reach progress=1 by ~8% of the target height visible
    // (Using a ratio is more stable than a fixed px value when the target height changes.)
    rangePx: isMobile ? 0.08 : window && window.innerHeight > 1000 ? 0.99 : 0.1,
    // Keep snapping gentle; CSS transition will handle visual smoothing.
    quantizeSteps: 100,
  });

  const previewCount = isTabletAndAbove ? 2 : 1;
  const previewItems = useMemo(() => cartItems.slice(0, previewCount), [cartItems, previewCount]);
  const remainingItems = useMemo(() => cartItems.slice(previewCount), [cartItems, previewCount]);
  const hasMoreItems = remainingItems.length > 0;

  const [accordionValue, setAccordionValue] = useState<string | undefined>(undefined);
  const cartCount = cartItems.length;
  const cartPlural = cartCount === 1 ? 'item' : 'items';

  const { retailPriceTotalNum, shippingPriceNum, currency, currency_symbol } =
    serverOrderDetails?.finalPricesWithShippingFee ?? {};

  const t = progress; // 0..1
  const ease = t * t * (3 - 2 * t); // smoothstep
  const opacity = 1 - ease; // overlay fades OUT as target becomes visible
  const glow = (1 - ease) * 0.75; // 0..0.75

  useEffect(() => {
    if (!hasMoreItems) {
      setAccordionValue(undefined);
    }
  }, [hasMoreItems]);

  // Main JSX
  return (
    <>
      <div
        className='bg-[#4C3D3D3D] backdrop-blur-[10px] p-4 rounded-[10px] md:p-10 space-y-8 lg:col-span-5 min-h-[25rem]'
        ref={originalSummaryTotalsRef}
      >
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
                  <AccordionContent className='pb-4 px-1 max-h-80 overflow-y-auto scrollbar'>
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

          {/* <div className='flex items-start gap-3'>
          <input
            className='input w-full !px-4 !py-2.5 !rounded-[10px] !border-[#F3F3F399] cursor-not-allowed'
            type='text'
            placeholder='Coupon or discount code'
            id='coupon'
            name='coupon'
            disabled
          />

          <button
            className='btn border-[#F3F3F366] text-[#F3F3F3] bg-[#F3F3F366] hover:bg-[#F3F3F366]/30 hover:text-[#F3F3F3] 
          !font-bold px-4 sm:px-6 !py-2.5 rounded-[10px] text-sm sm:text-base text-center shrink-0 cursor-not-allowed'
          >
            Apply
          </button>
        </div> */}

          <div>
            <OrderSummaryTotals
              cartCount={cartCount}
              retailPriceTotalNum={retailPriceTotalNum}
              shippingPriceNum={shippingPriceNum}
              currency={currency}
              currency_symbol={currency_symbol ?? ''}
            />
          </div>
        </div>
      </div>

      {(isMobile || isTabletOnly) && (
        <OrderSummaryTotals
          cartCount={cartCount}
          retailPriceTotalNum={retailPriceTotalNum}
          shippingPriceNum={shippingPriceNum}
          currency={currency}
          currency_symbol={currency_symbol ?? ''}
          slim
          className='fixed bottom-0 left-1/2 !z-50 w-full  -translate-x-1/2 
          shadow-[0px_0px_20px_5px_rgba(205,_205,_255,_0.75)]'
          style={{
            opacity,
            // Bold but professional: dark depth + subtle glass rim + controlled violet glow.
            boxShadow: `
              0 18px 55px rgba(0,0,0,0.70),
              0 0 0 1px rgba(255,255,255,0.06),
              0 0 26px rgba(205,205,255,${Math.max(0, Math.min(1, glow * 0.6))})
            `,
            // Smooth out step-like IntersectionObserver updates without touching transforms.
            transition: 'opacity 180ms ease-out, box-shadow 220ms ease-out',
            willChange: 'opacity, box-shadow',
            // Prevent accidental taps when the overlay is effectively invisible.
            pointerEvents: opacity < 0.05 ? 'none' : 'auto',
          }}
        />
      )}
    </>
  );
};

export default OrderSummary;

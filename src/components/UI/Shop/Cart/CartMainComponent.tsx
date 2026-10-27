'use client';

import { useCartStore } from '@/stores/shop_stores/cartStore';
import type { CartVariant } from '@/stores/shop_stores/cartStore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { getCartOverview } from '@/actions/shop/cart/getCartOverview';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { useCurrencyCookie } from '@/lib/utils/shop/globalFXProductPrice/currencyCookieStore';
import type { OrderPreviewTotals } from '@/lib/shop/checkout/orderMoney';
import {
  createCartAvailabilityMap,
  getCartVerificationIdentity,
  hasCheckoutBlockingCartItems,
  type CartItemAvailabilityMap,
  type CartItemAvailabilityStatus,
} from './cartAvailability';

type CartDisplayState = {
  cartIdentity: string | null;
  cartItems: CartVariant[];
  availabilityByVariantId: CartItemAvailabilityMap;
  totals?: OrderPreviewTotals | null;
  quoteCountry?: string;
  quoteError?: string | null;
  quoteSequence?: number;
};

// Dynamic Imports
const CartEmptyComponent = dynamic(
  () => import('./CartEmptyComponent').then((mod) => mod.CartEmptyComponent),
  {
    ssr: false,
  },
);
const CartItems = dynamic(() => import('./CartItems').then((mod) => mod.default), {
  ssr: false,
});
const OrderSummary = dynamic(() => import('./OrderSummary').then((mod) => mod.default), {
  ssr: false,
});

// Main component
const CartMainComponent = () => {
  // Hooks
  const { variants } = useCartStore((state) => state);
  const checkoutCountry = useShopCheckoutStore((state) => state.delivery_address.shipping_country);
  const selectedCountry = useCurrencyCookie((state) => state.iso3);
  const country = selectedCountry || checkoutCountry || 'USA';
  const cartIdentity = useMemo(() => getCartVerificationIdentity(variants), [variants]);
  const [quoteSequence, setQuoteSequence] = useState(0);
  const [cartDisplayState, setCartDisplayState] = useState<CartDisplayState>({
    cartIdentity: null,
    cartItems: [],
    availabilityByVariantId: {},
  });
  const isCartEmpty = useMemo(() => variants.length === 0, [variants.length]);
  const displayStateIsCurrent = cartDisplayState.cartIdentity === cartIdentity;
  const availabilityByVariantId = useMemo(
    () =>
      displayStateIsCurrent
        ? cartDisplayState.availabilityByVariantId
        : createCartAvailabilityMap(variants, 'checking'),
    [cartDisplayState.availabilityByVariantId, displayStateIsCurrent, variants],
  );
  const cartItemsForDisplay = useMemo(
    () =>
      isCartEmpty
        ? []
        : displayStateIsCurrent && cartDisplayState.cartItems.length === variants.length
          ? cartDisplayState.cartItems
          : variants,
    [cartDisplayState.cartItems, displayStateIsCurrent, isCartEmpty, variants],
  );
  const checkoutBlocked = useMemo(
    () => hasCheckoutBlockingCartItems(variants, availabilityByVariantId),
    [availabilityByVariantId, variants],
  );
  const handleAvailabilityChange = useCallback(
    (variantId: string, status: CartItemAvailabilityStatus) => {
      setCartDisplayState((current) =>
        current.cartIdentity === cartIdentity
          ? {
              ...current,
              availabilityByVariantId: {
                ...current.availabilityByVariantId,
                [variantId]: { status },
              },
            }
          : current,
      );
    },
    [cartIdentity],
  );

  useEffect(() => {
    let active = true;

    if (variants.length === 0) return;

    getCartOverview(variants, country)
      .then(({ cartItems, availabilityByVariantId: availability, totals, quoteError }) => {
        if (!active) return;
        setCartDisplayState({
          cartIdentity,
          cartItems,
          availabilityByVariantId: availability,
          totals,
          quoteCountry: country,
          quoteError,
          quoteSequence,
        });
      })
      .catch((error) => {
        console.warn('[CartMainComponent] Offline catalog cart hydration failed:', error);
        if (!active) return;
        setCartDisplayState({
          cartIdentity,
          cartItems: variants,
          availabilityByVariantId: createCartAvailabilityMap(variants, 'unverified'),
          quoteCountry: country,
          quoteSequence,
          quoteError:
            'We could not confirm availability and delivery right now. Please try again shortly.',
        });
      });

    return () => {
      active = false;
    };
  }, [cartIdentity, variants, country, quoteSequence]);

  // JSX
  return (
    <div
      className='px-2 py-4 md:px-[20px] lg:px-[24px] mx-auto mt-5 flex
    flex-col lg:flex-row gap-6 xl:gap-10'
    >
      {/* Container for cart contents */}
      <div
        className='bg-[#3D3D3D4D] backdrop-blur-[5px] text-white rounded-[20px] 
          min-h-[20svh] w-full sm:w-[85vw] md:w-[85vw] mx-auto lg:!w-[90vw] xl:!w-[85vw] py-8
          justify-center'
      >
        {/* Cart Title */}
        <h1 className=' font-light text-white text-4xl font-ocr text-left mb-4 pl-5'>
          Your Cart{' '}
          {!isCartEmpty ? `(${variants.length} item${variants.length > 1 ? 's' : ''})` : ''}
        </h1>

        {isCartEmpty && <CartEmptyComponent />}

        {/* If the cart is not empty, render the cart items */}
        {!isCartEmpty && variants && (
          <div className='flex flex-col gap-8 max-h-[90vh] px-5 overflow-y-auto scrollbar'>
            {/* All Cart Items */}
            <CartItems
              cartItems={cartItemsForDisplay}
              availabilityByVariantId={availabilityByVariantId}
              onAvailabilityChange={handleAvailabilityChange}
              prices={
                displayStateIsCurrent && cartDisplayState.quoteCountry === country
                  ? cartDisplayState.totals
                  : null
              }
            />
          </div>
        )}
      </div>

      {/* Conatiner for Order Summary */}
      {!isCartEmpty && variants && (
        <OrderSummary
          countryIso3={country}
          checkoutBlocked={checkoutBlocked}
          quotePending={
            !displayStateIsCurrent ||
            cartDisplayState.quoteCountry !== country ||
            cartDisplayState.quoteSequence !== quoteSequence
          }
          quoteError={
            cartDisplayState.quoteCountry === country ? cartDisplayState.quoteError : null
          }
          onRetryQuote={() => setQuoteSequence((sequence) => sequence + 1)}
          totals={
            displayStateIsCurrent &&
            cartDisplayState.quoteCountry === country &&
            cartDisplayState.quoteSequence === quoteSequence
              ? (cartDisplayState.totals ?? null)
              : null
          }
        />
      )}
    </div>
  );
};

export default CartMainComponent;

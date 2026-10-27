'use client';

import { useCartStore } from '@/stores/shop_stores/cartStore';
import type { CartVariant } from '@/stores/shop_stores/cartStore';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { getCartOverview } from '@/actions/shop/cart/getCartOverview';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { useCurrencyCookie } from '@/lib/utils/shop/globalFXProductPrice/currencyCookieStore';
import type { OrderPreviewTotals } from '@/lib/shop/checkout/orderMoney';
import CartSyncStatus from './CartSyncStatus';
import {
  createCartAvailabilityMap,
  getCartVerificationIdentity,
  hasCheckoutBlockingCartItems,
  type CartItemAvailabilityMap,
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

const CartMainComponent = () => {
  const variants = useCartStore((state) => state.variants);
  const hydrated = useCartStore((state) => state.hydrated);
  const conflictCount = useCartStore((state) => state.conflicts.length);
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
  const isCartEmpty = variants.length === 0;
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
    () => conflictCount > 0 || hasCheckoutBlockingCartItems(variants, availabilityByVariantId),
    [availabilityByVariantId, variants, conflictCount],
  );
  useEffect(() => {
    let active = true;

    if (!hydrated || variants.length === 0) return;

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
  }, [cartIdentity, variants, country, quoteSequence, hydrated]);

  return (
    <div
      className={`mx-auto mt-5 grid w-full min-w-0 max-w-[1440px] gap-6 px-2 py-4 md:px-5 lg:px-6 xl:gap-10 ${hydrated && !isCartEmpty ? 'lg:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)]' : ''}`}
    >
      <div className='min-h-[20svh] min-w-0 w-full rounded-[20px] bg-[#3D3D3D4D] py-6 text-white backdrop-blur-[5px] sm:py-8'>
        <h1 className='mb-4 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 px-4 text-left font-ocr text-[clamp(1.5rem,5vw,2.25rem)] font-light text-white sm:px-5'>
          <span>Your Cart</span>
          {hydrated && !isCartEmpty && (
            <span className='text-base sm:text-xl'>
              ({variants.length} item{variants.length > 1 ? 's' : ''})
            </span>
          )}
        </h1>

        <CartSyncStatus />

        {hydrated && isCartEmpty && <CartEmptyComponent />}

        {hydrated && !isCartEmpty && (
          <div className='scrollbar flex min-w-0 max-w-full max-h-[90vh] flex-col gap-4 overflow-y-auto px-4 sm:gap-6 sm:px-5'>
            <CartItems
              cartItems={cartItemsForDisplay}
              availabilityByVariantId={availabilityByVariantId}
              prices={
                displayStateIsCurrent && cartDisplayState.quoteCountry === country
                  ? cartDisplayState.totals
                  : null
              }
            />
          </div>
        )}
      </div>

      {hydrated && !isCartEmpty && (
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

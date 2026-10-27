'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ShoppingCart } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '../../primitives/button';
import { useCartStore } from '@/stores/shop_stores/cartStore';
import { useCurrencyCookie } from '@/lib/utils/shop/globalFXProductPrice/currencyCookieStore';
import { useShopRouter } from '@/lib/hooks/useShopRouter';
import type { ProductVariantsInterface } from '@/lib/merchizeStorefront/productTypes';
import { isMerchizeStorefrontVariantAvailable } from '@/lib/paypal/orderSnapshot/merchizeAvailability';
import {
  findMatchingVariantForSelections,
  setupVariantAutoMatching,
  useCurrentVariant,
} from './currentVariantStore';
import CustomShopLink from '../HelperComponents/CustomShopLink';

export function ProductPurchaseActions({
  productId,
  variants,
  productMetaData,
  isLoadingVariants = false,
}: {
  productId: string;
  variants: ProductVariantsInterface['data'];
  productMetaData: { title: string; slug: string };
  isLoadingVariants?: boolean;
}) {
  const { push } = useShopRouter();
  const country = useCurrencyCookie((state) => state.iso3) || 'USA';
  const { addToCart, hydrated } = useCartStore(
    useShallow((state) => ({
      addToCart: state.addToCart,
      hydrated: state.hydrated,
    })),
  );
  const { currentVariantOptions, resetVariantOptions } = useCurrentVariant(
    useShallow((state) => ({
      currentVariantOptions: state.currentVariantOptions,
      resetVariantOptions: state.resetVariantOptions,
    })),
  );
  const currentVariants = useMemo(
    () =>
      variants.filter(
        (variant) =>
          variant?.product === productId &&
          typeof variant._id === 'string' &&
          variant._id.trim() &&
          typeof variant.sku === 'string' &&
          variant.sku.trim() &&
          Array.isArray(variant.options) &&
          isMerchizeStorefrontVariantAvailable(variant),
      ),
    [variants, productId],
  );
  const matchingVariant = useMemo(
    () => findMatchingVariantForSelections(currentVariants, currentVariantOptions),
    [currentVariants, currentVariantOptions],
  );
  const scope = useMemo(
    () => ({ productId, country, currentVariants }),
    [productId, country, currentVariants],
  );
  const currentScope = useRef(scope);
  const mounted = useRef(false);
  const submitting = useRef(false);
  const [pending, setPending] = useState<'cart' | 'checkout' | null>(null);
  const [error, setError] = useState<{ scope: typeof scope; message: string } | null>(null);
  const canSubmit = hydrated && !isLoadingVariants && Boolean(matchingVariant);

  useLayoutEffect(() => {
    currentScope.current = scope;
  }, [scope]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = setupVariantAutoMatching(currentVariants);
    return () => {
      unsubscribe();
      resetVariantOptions();
    };
  }, [currentVariants, country, resetVariantOptions]);

  async function submit(destination: 'cart' | 'checkout') {
    if (submitting.current || !canSubmit) return;
    const variant = findMatchingVariantForSelections(
      currentVariants,
      useCurrentVariant.getState().currentVariantOptions,
    );
    if (!variant) return;
    submitting.current = true;
    setPending(destination);
    setError(null);
    const owner = useCartStore.getState().owner;
    try {
      await addToCart({
        variantId: variant._id,
        quantity: 1,
        itemDetail: variant,
        title: productMetaData.title,
        slug: productMetaData.slug,
      });
      if (
        !mounted.current ||
        currentScope.current !== scope ||
        useCartStore.getState().owner !== owner ||
        findMatchingVariantForSelections(
          currentVariants,
          useCurrentVariant.getState().currentVariantOptions,
        )?._id !== variant._id
      )
        return;
      resetVariantOptions();
      if (destination === 'checkout') push('/shop/checkout');
      else void cartSuccessToast().catch(() => {});
    } catch {
      if (
        mounted.current &&
        currentScope.current === scope &&
        useCartStore.getState().owner === owner
      ) {
        setError({ scope, message: 'We could not save this item. Please try again.' });
      }
    } finally {
      submitting.current = false;
      if (mounted.current) setPending(null);
    }
  }

  return (
    <>
      <Button
        name='Add to Cart'
        type='button'
        disabled={!canSubmit || pending !== null}
        aria-busy={pending === 'cart'}
        onClick={() => void submit('cart')}
        className='flex w-full items-center justify-between gap-2 rounded-lg bg-white !px-8 !py-6 text-xl font-bold text-black hover:bg-white'
      >
        <span className='mx-auto min-w-0 truncate'>
          {isLoadingVariants || !hydrated
            ? 'Loading Options...'
            : !currentVariants.length
              ? 'Unavailable'
              : pending === 'cart'
                ? 'Adding...'
                : !canSubmit
                  ? 'Select Options'
                  : 'Add to Cart'}
        </span>
        <ShoppingCart size={26} className='shrink-0' aria-hidden='true' />
      </Button>
      <Button
        name='Buy Now'
        type='button'
        disabled={!canSubmit || pending !== null}
        aria-busy={pending === 'checkout'}
        onClick={() => void submit('checkout')}
        className='flex h-auto w-full items-center justify-between gap-2 rounded-lg border border-white bg-black px-8 py-3.5 text-xl font-bold text-white hover:bg-white/10'
      >
        <span className='mx-auto min-w-0 truncate'>
          {pending === 'checkout' ? 'Opening...' : 'Buy Now'}
        </span>
        <ArrowRight size={20} className='shrink-0' aria-hidden='true' />
      </Button>
      {error?.scope === scope && (
        <p role='alert' className='text-sm text-white/80'>
          {error.message}
        </p>
      )}
    </>
  );
}

async function cartSuccessToast() {
  const { toast } = await import('sonner');
  toast.success('Saved to cart', {
    description: 'Item saved to your cart. Availability is checked at checkout.',
    action: (
      <CustomShopLink href='/shop/cart' className='underline'>
        View Cart
      </CustomShopLink>
    ),
    position: 'top-right',
  });
}

'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Close, Content, Overlay, Portal } from '@radix-ui/react-dialog';
import { LoaderCircle, X } from 'lucide-react';
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/UI/primitives/dialog';
import { useCartStore } from '@/stores/shop_stores/cartStore';
import { useCurrencyCookie } from '@/lib/utils/shop/globalFXProductPrice/currencyCookieStore';
import type { WishlistProduct } from '@/lib/wishlist/types';
import GlobalProductPrice from '../GlobalShopComponents/GlobalProductPrice';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import { isCartVariant, variantLabel, type WishlistCartVariant } from './wishlistCartOptions';

type CartProduct = Pick<WishlistProduct, 'productId' | 'title' | 'slug'>;
type Variant = WishlistCartVariant;
type OptionsState = {
  loading: boolean;
  variants: Variant[];
  error: string | null;
  notice: string | null;
};

// Known options remain usable while this loaded app is offline. They are rechecked at checkout.
const optionsCache = new Map<string, Variant[]>();

const buttonClassName =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/70 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-50';

function CartOptions({
  item,
  country,
  onClose,
}: {
  item: CartProduct;
  country: string;
  onClose: () => void;
}) {
  const optionId = useId();
  const [state, setState] = useState<OptionsState>({
    loading: true,
    variants: [],
    error: null,
    notice: null,
  });
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const mounted = useRef(false);
  const submitting = useRef(false);
  const addToCart = useCartStore((store) => store.addToCart);
  const selected = state.variants.find((variant) => variant._id === selectedId);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadOptions() {
      const cacheKey = `${item.productId}:${country}`;
      const cached = optionsCache.get(cacheKey);
      const cachedNotice =
        'Previously loaded options. Price and availability are checked at checkout.';
      setState({
        loading: !cached,
        variants: cached ?? [],
        error: null,
        notice: cached ? cachedNotice : null,
      });
      setSelectedId('');
      setAddError(null);
      try {
        if (!navigator.onLine)
          throw new Error('Connect to load this product’s options for the first time.');
        const response = await fetch(
          `/next-api/shop/products/${encodeURIComponent(item.productId)}/variants?country=${encodeURIComponent(country)}`,
          { cache: 'no-store', signal: controller.signal },
        );
        const result: unknown = await response.json();
        if (!result || typeof result !== 'object')
          throw new Error('Product options could not be loaded.');
        const payload = result as Record<string, unknown>;
        if (!response.ok) {
          throw new Error(
            typeof payload.error === 'string'
              ? payload.error
              : 'Product options could not be loaded.',
          );
        }
        if (!Array.isArray(payload.data)) throw new Error('Product options could not be loaded.');
        const variants = payload.data.filter((variant) => isCartVariant(variant, item.productId));
        if (variants.length !== payload.data.length) {
          throw new Error('Some product options could not be verified. Please try again.');
        }
        if (controller.signal.aborted) return;
        optionsCache.delete(cacheKey);
        if (optionsCache.size >= 50) optionsCache.delete(optionsCache.keys().next().value!);
        optionsCache.set(cacheKey, variants);
        const notice = payload.verificationIncomplete
          ? 'Some options could not be verified. Only verified options are shown.'
          : typeof payload.unavailabilityReason === 'string'
            ? payload.unavailabilityReason
            : null;
        setState({ loading: false, variants, error: null, notice });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          loading: false,
          variants: cached ?? [],
          error: cached
            ? null
            : error instanceof Error
              ? error.message
              : 'Product options could not be loaded.',
          notice: cached ? cachedNotice : null,
        });
      }
    }

    void loadOptions();
    return () => controller.abort();
  }, [item.productId, country, retry]);

  async function submit() {
    if (!selected || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setAddError(null);
    try {
      await addToCart({
        variantId: selected._id,
        quantity: 1,
        itemDetail: selected,
        title: item.title,
        slug: item.slug || item.productId,
      });
      const { toast } = await import('sonner');
      toast.success('Saved to cart', { description: item.title });
      if (mounted.current) onClose();
    } catch {
      if (mounted.current) setAddError('We could not add this item right now. Please try again.');
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <div className='grid gap-5'>
      {state.loading ? (
        <p role='status' className='flex items-center gap-2 py-6 text-sm text-white/75'>
          <LoaderCircle
            aria-hidden='true'
            className='size-4 animate-spin motion-reduce:animate-none'
          />
          Checking available options…
        </p>
      ) : state.error ? (
        <div className='grid justify-items-start gap-3'>
          <p role='alert' className='text-sm text-white/80'>
            {state.error}
          </p>
          <button
            type='button'
            className={buttonClassName}
            onClick={() => setRetry((value) => value + 1)}
          >
            Try again
          </button>
        </div>
      ) : state.variants.length === 0 ? (
        <p role='status' className='text-sm text-white/75'>
          {state.notice ||
            'This product currently has no available options for your delivery country.'}
        </p>
      ) : (
        <>
          <div className='grid gap-2'>
            <label htmlFor={optionId} className='text-sm font-medium'>
              Choose an option
            </label>
            <select
              id={optionId}
              value={selectedId}
              disabled={busy}
              onChange={(event) => {
                setSelectedId(event.target.value);
                setAddError(null);
              }}
              className='min-h-12 w-full rounded-xl border border-white/40 bg-[#171717] px-3 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50'
            >
              <option value=''>Select your preferred option</option>
              {state.variants.map((variant) => (
                <option key={variant._id} value={variant._id}>
                  {variantLabel(variant)}
                </option>
              ))}
            </select>
            {state.notice && <p className='text-xs text-white/65'>{state.notice}</p>}
          </div>
          {selected && (
            <GlobalProductPrice usdAmount={selected.retail_price} className='text-lg font-medium' />
          )}
          {addError && (
            <div className='grid justify-items-start gap-2'>
              <p role='alert' className='text-sm text-red-200'>
                {addError}
              </p>
              <button
                type='button'
                disabled={busy}
                className='text-sm underline underline-offset-4'
                onClick={() => setRetry((value) => value + 1)}
              >
                Refresh options
              </button>
            </div>
          )}
          <button
            type='button'
            disabled={!selected || busy}
            onClick={() => void submit()}
            className={`${buttonClassName} w-full bg-white text-black hover:bg-white/90`}
          >
            {busy && (
              <LoaderCircle
                aria-hidden='true'
                className='size-4 animate-spin motion-reduce:animate-none'
              />
            )}
            {busy ? 'Adding…' : 'Add to Cart +'}
          </button>
        </>
      )}
      <CustomShopLink
        href={`/shop/product/${encodeURIComponent(item.productId)}`}
        ariaLabel={`View ${item.title}`}
        className='justify-self-start text-sm text-white/70 underline underline-offset-4 hover:text-white'
      >
        View product details
      </CustomShopLink>
    </div>
  );
}

export default function WishlistCartDialog({
  item,
  onClose,
}: {
  item: CartProduct | null;
  onClose: () => void;
}) {
  const country = useCurrencyCookie((store) => store.iso3) || 'USA';

  return (
    <Dialog
      open={Boolean(item)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {item && (
        <Portal>
          <Overlay className='fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm' />
          <Content className='fixed left-1/2 top-1/2 z-[120] grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-2xl border border-white/20 bg-[#111] p-6 text-white shadow-lg'>
            <DialogHeader className='gap-2 pr-5 text-left'>
              <DialogTitle className='text-xl leading-snug'>{item.title}</DialogTitle>
              <DialogDescription className='text-white/65'>
                Choose your options before adding this saved product to your cart.
              </DialogDescription>
            </DialogHeader>
            <CartOptions
              key={`${item.productId}:${country}`}
              item={item}
              country={country}
              onClose={onClose}
            />
            <Close className='absolute right-4 top-4 rounded-sm text-white/70 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white'>
              <X aria-hidden='true' className='size-4' />
              <span className='sr-only'>Close</span>
            </Close>
          </Content>
        </Portal>
      )}
    </Dialog>
  );
}

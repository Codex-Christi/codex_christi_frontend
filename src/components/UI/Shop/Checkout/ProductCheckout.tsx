'use client';

import dynamic from 'next/dynamic';
import { createContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, Check, Loader2, RefreshCw } from 'lucide-react';
import { ServerOrderDetailsComponent } from './ServerOrderDetailsComponent';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { useCartStore } from '@/stores/shop_stores/cartStore';
import { getOrderFinalDetails } from '@/actions/shop/checkout/getOrderFinalDetails';
import { getCartVerificationIdentity } from '../Cart/cartAvailability';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import { useCurrencyCookie } from '@/lib/utils/shop/globalFXProductPrice/currencyCookieStore';
import CheckoutStorageNotice from './CheckoutStorageNotice';
import { useAuthStore } from '@/stores/authStore';
import { claimCurrentCheckout } from '@/lib/hooks/shopHooks/checkout/claimCurrentCheckout';
import { usePayPalIntentStore } from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import { checkoutPanelClassName } from './checkoutStyles';
import { useDjangoOrderIntentStore } from '@/stores/shop_stores/checkoutStore/djangoOrderIntentStore';
import { canResumeVerifiedCheckout } from '@/lib/hooks/shopHooks/checkout/canResumeVerifiedCheckout';

const CheckoutPageOrderSummary = dynamic(() => import('./CheckoutPageOrderSummary'));
const CheckoutAttemptRecovery = dynamic(() => import('./CheckoutAttemptRecovery'));
const PaymentSection = dynamic(() => import('./PaymentSection'));
const BasicCheckoutInfo = dynamic(() =>
  import('./UserCheckoutSummary/BasicCheckoutInfo').then((module) => module.BasicCheckoutInfo),
);

type CheckoutStep = 'basic-checkout-info' | 'payment-section';
export const CheckoutAccordionContext = createContext<{
  handleOpenItem: (step: CheckoutStep) => void;
  canContinue: boolean;
  refreshQuote: () => void;
  requestVerification: (message: string) => void;
}>({
  handleOpenItem: () => {},
  canContinue: false,
  refreshQuote: () => {},
  requestVerification: () => {},
});

type QuoteState = {
  identity: string;
  details?: Awaited<ReturnType<typeof getOrderFinalDetails>>;
  error?: string;
};

export default function CheckoutPage() {
  const [step, setStep] = useState<CheckoutStep>('basic-checkout-info');
  const restoredStep = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const authenticatedOwner = useAuthStore((state) =>
    state.isAuthenticated ? state.accountOwnerId : null,
  );
  const checkoutOwner = useAuthStore((state) => state.accountOwnerId);
  const activeOrderToken = usePayPalIntentStore((state) => state.checkoutAttempt?.orderToken);
  const cartVariants = useCartStore((state) => state.variants);
  const cartHydrated = useCartStore((state) => state.hydrated);
  const hasCartConflicts = useCartStore((state) => state.conflicts.length > 0);
  const checkoutHydrated = useSyncExternalStore(
    useShopCheckoutStore.persist.onFinishHydration,
    useShopCheckoutStore.persist.hasHydrated,
    () => false,
  );
  const verificationHydrated = useSyncExternalStore(
    useDjangoOrderIntentStore.persist.onFinishHydration,
    useDjangoOrderIntentStore.persist.hasHydrated,
    () => false,
  );
  const checkoutCountry = useShopCheckoutStore((state) => state.delivery_address.shipping_country);
  const selectedCountry = useCurrencyCookie((state) => state.iso3);
  const country = selectedCountry || checkoutCountry || 'USA';
  const cartIdentity = useMemo(() => getCartVerificationIdentity(cartVariants), [cartVariants]);
  const [quoteVersion, setQuoteVersion] = useState(0);
  const quoteIdentity = `${country}:${cartIdentity}:${quoteVersion}`;
  const [quote, setQuote] = useState<QuoteState | null>(null);
  const currentQuote = quote?.identity === quoteIdentity ? quote : null;
  const details = currentQuote?.details ?? null;
  const hydrated = cartHydrated && checkoutHydrated;
  const quotePending = hydrated && cartVariants.length > 0 && !hasCartConflicts && !currentQuote;
  const canContinue = Boolean(details) && !hasCartConflicts;
  const refreshQuote = () => setQuoteVersion((version) => version + 1);

  useEffect(() => {
    if (!useShopCheckoutStore.persist.hasHydrated()) void useShopCheckoutStore.persist.rehydrate();
  }, []);
  useEffect(() => {
    if (!checkoutHydrated || !verificationHydrated || restoredStep.current) return;
    let active = true;
    queueMicrotask(() => {
      if (!active || restoredStep.current) return;
      restoredStep.current = true;
      if (
        canResumeVerifiedCheckout(
          useShopCheckoutStore.getState(),
          useDjangoOrderIntentStore.getState(),
        )
      )
        setStep('payment-section');
    });
    return () => {
      active = false;
    };
  }, [checkoutHydrated, verificationHydrated]);
  useEffect(() => {
    if (authenticatedOwner && activeOrderToken) void claimCurrentCheckout();
  }, [authenticatedOwner, activeOrderToken]);

  useEffect(() => {
    if (!hydrated || !cartVariants.length || hasCartConflicts) return;
    let active = true;
    getOrderFinalDetails(cartVariants, country, 'merchize')
      .then((result) => {
        if (active) setQuote({ identity: quoteIdentity, details: result });
      })
      .catch((error: unknown) => {
        console.warn('[checkout] Quote unavailable', error);
        if (active)
          setQuote({
            identity: quoteIdentity,
            error:
              'We couldn’t confirm current prices, availability, and delivery. Your details are still here. Try again before paying.',
          });
      });
    return () => {
      active = false;
    };
  }, [hydrated, cartVariants, country, hasCartConflicts, quoteIdentity]);

  return (
    <ServerOrderDetailsComponent details={details}>
      <CheckoutAccordionContext.Provider
        value={{
          handleOpenItem: (nextStep) => {
            setNotice(null);
            setStep(nextStep);
          },
          canContinue,
          refreshQuote,
          requestVerification: (message) => {
            setNotice(message);
            setStep('basic-checkout-info');
          },
        }}
      >
        <main className='mx-auto w-full min-w-0 max-w-[1280px] px-3 py-6 text-white sm:px-5 sm:py-8 lg:px-6'>
          <header className='mb-6 flex min-w-0 flex-wrap items-center justify-between gap-4'>
            <CustomShopLink
              href='/shop/cart'
              className='inline-flex min-h-11 items-center gap-2 text-sm text-white/80 hover:text-white'
            >
              <ArrowLeft size={20} aria-hidden='true' /> Back to cart
            </CustomShopLink>
            <h1 className='text-2xl font-semibold sm:text-3xl'>Checkout</h1>
          </header>
          <CheckoutAttemptRecovery>
            {!hydrated ? (
              <p
                role='status'
                className={`${checkoutPanelClassName} flex min-h-48 items-center justify-center gap-3`}
              >
                <Loader2 className='animate-spin' size={20} aria-hidden='true' /> Loading your
                checkout…
              </p>
            ) : !cartVariants.length ? (
              <section className={`${checkoutPanelClassName} p-6 text-center`}>
                <h2 className='text-xl font-semibold'>Your cart is empty</h2>
                <p className='mt-2 text-sm text-white/70'>Add an item before checking out.</p>
                <CustomShopLink
                  href='/shop'
                  className='mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#0085ff] px-5 font-semibold'
                >
                  Continue shopping
                </CustomShopLink>
              </section>
            ) : (
              <div className='grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,1fr)] lg:gap-6'>
                <CheckoutPageOrderSummary />
                <section
                  className={`${checkoutPanelClassName} order-2 min-w-0 p-4 sm:p-6 lg:order-1 lg:p-8`}
                >
                  <CheckoutStorageNotice />
                  {notice && (
                    <p
                      role='alert'
                      className='mb-5 rounded-xl border border-amber-200/30 p-3 text-sm leading-6 text-amber-100'
                    >
                      {notice}
                    </p>
                  )}
                  <ol
                    aria-label='Checkout steps'
                    className='mb-5 grid grid-cols-2 gap-3 border-b border-white/20 pb-4 text-sm'
                  >
                    {(['Contact & delivery', 'Review & pay'] as const).map((label, index) => (
                      <li
                        key={label}
                        aria-current={
                          (step === 'payment-section' ? 1 : 0) === index ? 'step' : undefined
                        }
                        className={`flex min-w-0 items-center gap-2 ${index === 0 || step === 'payment-section' ? 'text-white' : 'text-white/45'}`}
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${index === 0 && step === 'payment-section' ? 'border-[#0085ff] bg-[#0085ff]' : 'border-current'}`}
                        >
                          {index === 0 && step === 'payment-section' ? (
                            <Check size={15} aria-hidden='true' />
                          ) : (
                            index + 1
                          )}
                        </span>
                        <span>{label}</span>
                      </li>
                    ))}
                  </ol>
                  {hasCartConflicts && (
                    <div
                      role='alert'
                      className='mb-5 rounded-xl border border-amber-200/30 bg-amber-100/5 p-4 text-sm text-amber-100'
                    >
                      Choose the quantities you want before paying.{' '}
                      <CustomShopLink href='/shop/cart' className='font-semibold underline'>
                        Compare in your cart
                      </CustomShopLink>
                      .
                    </div>
                  )}
                  {quotePending && (
                    <p role='status' className='mb-5 flex items-center gap-2 text-sm text-white/70'>
                      <Loader2 size={16} className='shrink-0 animate-spin' aria-hidden='true' />{' '}
                      Updating prices and delivery…
                    </p>
                  )}
                  {currentQuote?.error && (
                    <div
                      role='alert'
                      className='mb-5 space-y-3 rounded-xl border border-amber-200/30 bg-amber-100/5 p-4 text-sm text-amber-100'
                    >
                      <p>{currentQuote.error}</p>
                      <div className='flex flex-wrap gap-4'>
                        <button
                          type='button'
                          onClick={refreshQuote}
                          className='inline-flex min-h-11 items-center gap-2 rounded-lg border border-current px-3 font-semibold'
                        >
                          <RefreshCw size={15} aria-hidden='true' /> Try again
                        </button>
                        <CustomShopLink
                          href='/shop/cart'
                          className='inline-flex min-h-11 items-center underline'
                        >
                          Review cart
                        </CustomShopLink>
                      </div>
                    </div>
                  )}
                  <div hidden={step !== 'basic-checkout-info'}>
                    <BasicCheckoutInfo key={checkoutOwner ?? 'guest'} />
                  </div>
                  {step === 'payment-section' && <PaymentSection />}
                </section>
              </div>
            )}
          </CheckoutAttemptRecovery>
        </main>
      </CheckoutAccordionContext.Provider>
    </ServerOrderDetailsComponent>
  );
}

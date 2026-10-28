'use client';

import dynamic from 'next/dynamic';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usePayPalIntentStore } from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import {
  loadOriginalCheckout,
  originalCheckoutScope,
} from '@/lib/hooks/shopHooks/checkout/originalCheckout';
import type { OriginalCheckout } from '@/lib/shop/checkout/originalCheckout';
import ActivePayPalCheckoutRecoveryBanner from './Paypal/ActivePayPalCheckoutRecoveryBanner';
import OriginalCheckoutReview from './OriginalCheckoutReview';
import { checkoutPanelClassName } from './checkoutStyles';

const PayPalCheckout = dynamic(() => import('./Paypal/PayPalMainCheckoutComponent'));

/** The saved purchase remains reachable even when the merged cart has no usable quote. */
export default function CheckoutAttemptRecovery({ children }: { children: ReactNode }) {
  const attempt = usePayPalIntentStore((state) => state.checkoutAttempt);
  const owner = useAuthStore((state) => state.accountOwnerId);
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const scope = `${originalCheckoutScope()}:${owner}:${authenticated}`;
  const [loaded, setLoaded] = useState<{ scope: string; checkout: OriginalCheckout } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<{ scope: string; message: string } | null>(null);
  const [version, setVersion] = useState(0);
  const sequence = useRef(0);
  useEffect(
    () => () => {
      sequence.current += 1;
    },
    [],
  );
  const original = loaded?.scope === scope && attempt?.orderToken ? loaded.checkout : null;

  const openOriginal = async () => {
    if (!attempt || pending === scope) return;
    const request = ++sequence.current;
    const started = originalCheckoutScope();
    setPending(scope);
    setError(null);
    try {
      const checkout = await loadOriginalCheckout(attempt);
      if (sequence.current === request && originalCheckoutScope() === started)
        setLoaded({ scope, checkout });
    } catch (failure) {
      if (sequence.current === request && originalCheckoutScope() === started)
        setError({
          scope,
          message: failure instanceof Error ? failure.message : 'Check the original order status.',
        });
    } finally {
      if (sequence.current === request) setPending(null);
    }
  };

  return (
    <>
      {attempt?.orderToken && (
        <section className={`${checkoutPanelClassName} mb-5 min-w-0 p-4 sm:p-5`}>
          <ActivePayPalCheckoutRecoveryBanner
            onContinueOriginal={() => void openOriginal()}
            reviewing={pending === scope}
            onStartSeparateOrder={() => {
              sequence.current += 1;
              setLoaded(null);
              setError(null);
              setVersion((value) => value + 1);
            }}
          />
          {error?.scope === scope && (
            <p role='alert' className='mt-3 text-sm text-amber-100'>
              {error.message}
            </p>
          )}
          {original && (
            <OriginalCheckoutReview
              key={`${scope}:${original.reviewKey}`}
              checkout={original}
              onBack={() => setLoaded(null)}
              renderPayment={(mode) => <PayPalCheckout mode={mode} />}
            />
          )}
        </section>
      )}
      {!original && <Fragment key={version}>{children}</Fragment>}
    </>
  );
}

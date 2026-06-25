'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, RefreshCw, SearchCheck, X } from 'lucide-react';
import { Button } from '@/components/UI/primitives/button';
import errorToast from '@/lib/error-toast';
import successToast from '@/lib/success-toast';
import { useShopRouter } from '@/lib/hooks/useShopRouter';
import {
  isActivePayPalCheckoutFresh,
  usePayPalIntentStore,
  type ActivePayPalCheckoutStage,
} from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import type { PayPalTxPaymentStatusResponse } from '@/lib/paypal/txLedger/mapLedgerToProcessingState';

const CONFIRMATION_STATUSES = new Set([
  'captured',
  'receipt_uploaded',
  'payment_saved',
  'fulfillment_blocked',
  'fulfillment_failed',
  'fulfillment_attention_required',
  'completed',
  'error',
]);

function getStageCopy(stage: ActivePayPalCheckoutStage) {
  if (stage === 'paypal_cancelled') {
    return {
      title: 'Payment was not completed',
      description: 'You have not been charged. You can try PayPal again when ready.',
    };
  }

  if (stage === 'capture_checking' || stage === 'paypal_approved') {
    return {
      title: 'Recent PayPal approval found',
      description: 'Check the ledger before starting over.',
    };
  }

  return {
    title: 'Recent PayPal checkout found',
    description: 'If you left PayPal early, we can check whether anything moved.',
  };
}

type ActivePayPalCheckoutRecoveryBannerProps = {
  onRetryPayPal: () => void;
};

export default function ActivePayPalCheckoutRecoveryBanner({
  onRetryPayPal,
}: ActivePayPalCheckoutRecoveryBannerProps) {
  const { push } = useShopRouter();
  const [isChecking, setIsChecking] = useState(false);
  const activeCheckout = usePayPalIntentStore((store) => store.activeCheckout);
  const setActiveCheckoutStage = usePayPalIntentStore((store) => store.setActiveCheckoutStage);
  const clearActiveCheckout = usePayPalIntentStore((store) => store.clearActiveCheckout);
  const isFresh = isActivePayPalCheckoutFresh(activeCheckout);
  const copy = useMemo(
    () => getStageCopy(activeCheckout?.stage ?? 'paypal_order_created'),
    [activeCheckout?.stage],
  );

  useEffect(() => {
    if (activeCheckout && !isFresh) clearActiveCheckout();
  }, [activeCheckout, clearActiveCheckout, isFresh]);

  const checkStatus = useCallback(async () => {
    if (!activeCheckout) return;

    setIsChecking(true);
    try {
      const response = await fetch(
        `/next-api/paypal/tx-ledger/payments/${encodeURIComponent(activeCheckout.orderToken)}/status`,
        { cache: 'no-store' },
      );

      if (response.status === 404) {
        clearActiveCheckout();
        successToast({
          header: 'No payment found',
          message: 'That PayPal attempt did not create a payment record.',
        });
        return;
      }

      if (!response.ok) throw new Error(`Unable to check payment status: ${response.status}`);

      const status = (await response.json()) as PayPalTxPaymentStatusResponse;
      const shouldOpenConfirmation =
        status.customerRecoveryStatus === 'paid_unresolved' ||
        CONFIRMATION_STATUSES.has(status.status);

      if (shouldOpenConfirmation) {
        setActiveCheckoutStage('confirmation_opened', {
          orderToken: activeCheckout.orderToken,
        });
        push(`/shop/checkout/confirmation/${encodeURIComponent(activeCheckout.orderToken)}`);
        return;
      }

      successToast({
        header: 'No completed payment yet',
        message: 'We did not find a completed PayPal capture. You can continue checkout safely.',
      });
    } catch (error) {
      errorToast({
        header: 'Status check failed',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsChecking(false);
    }
  }, [activeCheckout, clearActiveCheckout, push, setActiveCheckoutStage]);

  if (!activeCheckout || !isFresh) return null;

  return (
    <div className='overflow-hidden rounded-2xl border border-cyan-100/16 bg-cyan-50/[0.045] p-4 text-white shadow-[0_18px_38px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl'>
      <div className='flex items-start gap-3'>
        <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cyan-100/20 bg-cyan-100/[0.08] text-cyan-50'>
          <CreditCard size={17} />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex items-start justify-between gap-3'>
            <div>
              <p className='text-sm font-semibold text-white'>{copy.title}</p>
              <p className='mt-1 text-xs leading-5 text-white/62'>{copy.description}</p>
            </div>
            <button
              type='button'
              onClick={clearActiveCheckout}
              className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/58 transition hover:bg-white/[0.08] hover:text-white'
              aria-label='Dismiss recent PayPal checkout'
            >
              <X size={14} />
            </button>
          </div>

          <div className='mt-3 flex flex-col gap-2 sm:flex-row'>
            <Button
              name='Check PayPal Status'
              onClick={checkStatus}
              disabled={isChecking}
              className='h-auto gap-2 rounded-full border border-cyan-100/25 bg-cyan-100/[0.1] px-4 py-2 text-xs font-semibold text-cyan-50 hover:bg-cyan-100/[0.16]'
            >
              {isChecking ? (
                <RefreshCw className='h-3.5 w-3.5 animate-spin' />
              ) : (
                <SearchCheck size={14} />
              )}
              Check status
            </Button>
            <Button
              name='Try PayPal Again'
              onClick={onRetryPayPal}
              className='h-auto rounded-full border border-white/12 bg-white/[0.045] px-4 py-2 text-xs font-semibold text-white/78 hover:bg-white/[0.08] hover:text-white'
            >
              Try PayPal again
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

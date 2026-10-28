'use client';

import { useCallback, useMemo, useState } from 'react';
import { CreditCard, RefreshCw, SearchCheck } from 'lucide-react';
import { Button } from '@/components/UI/primitives/button';
import errorToast from '@/lib/error-toast';
import { useShopRouter } from '@/lib/hooks/useShopRouter';
import {
  usePayPalIntentStore,
  captureCheckoutAttempt,
  isCurrentCheckoutAttempt,
  setCheckoutAttemptStage,
  type CheckoutAttempt,
  type ActivePayPalCheckout,
  type ActivePayPalCheckoutStage,
} from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import type { PayPalTxPaymentStatusResponse } from '@/lib/paypal/txLedger/mapLedgerToProcessingState';
import {
  canStartSeparateCheckout,
  startSeparateCheckout,
} from '@/lib/hooks/shopHooks/checkout/checkoutAttemptRecovery';
import { claimCurrentCheckout } from '@/lib/hooks/shopHooks/checkout/claimCurrentCheckout';
import { flushCheckoutStorage } from '@/stores/shop_stores/checkoutStore/storage';
import { readCheckoutStatus } from '@/lib/hooks/shopHooks/checkout/readCheckoutStatus';
import {
  canReopenCheckoutPayment,
  originalCheckoutScope,
} from '@/lib/hooks/shopHooks/checkout/originalCheckout';
import CustomShopLink from '../../HelperComponents/CustomShopLink';

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

function getStageCopy(stage: ActivePayPalCheckoutStage, paymentLabel: string) {
  if (stage === 'paypal_cancelled') {
    return {
      title: 'PayPal window closed',
      description: `Check this payment before reopening the ${paymentLabel} or starting a separate order.`,
    };
  }

  if (stage === 'capture_checking' || stage === 'paypal_approved') {
    return {
      title: 'Recent PayPal approval found',
      description: 'Check this payment before starting another order.',
    };
  }

  return {
    title: 'Recent checkout attempt found',
    description: `If you left the ${paymentLabel} early, we can check whether anything moved.`,
  };
}

type ActivePayPalCheckoutRecoveryBannerProps = {
  onContinueOriginal: () => void;
  reviewing?: boolean;
  onStartSeparateOrder?: () => void;
};

export default function ActivePayPalCheckoutRecoveryBanner({
  onContinueOriginal,
  reviewing = false,
  onStartSeparateOrder,
}: ActivePayPalCheckoutRecoveryBannerProps) {
  const { push } = useShopRouter();
  const [isChecking, setIsChecking] = useState(false);
  const attempt = usePayPalIntentStore((store) => store.checkoutAttempt);
  const storedActive = usePayPalIntentStore((store) => store.activeCheckout);
  const activeCheckout = useMemo<ActivePayPalCheckout | null>(
    () =>
      attempt?.orderToken
        ? storedActive?.orderToken === attempt.orderToken
          ? storedActive
          : {
              orderToken: attempt.orderToken,
              stage: 'paypal_order_created',
              createdAt: '',
              updatedAt: '',
            }
        : null,
    [attempt, storedActive],
  );
  const [unpaid, setUnpaid] = useState<PayPalTxPaymentStatusResponse | null>(null);
  const [confirmSeparate, setConfirmSeparate] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const paymentLabel = activeCheckout?.paymentSurface === 'card' ? 'card form' : 'PayPal checkout';
  const copy = getStageCopy(activeCheckout?.stage ?? 'paypal_order_created', paymentLabel);

  const loadStatus = useCallback(async (captured: CheckoutAttempt) => {
    const scope = originalCheckoutScope();
    const current = () => isCurrentCheckoutAttempt(captured) && originalCheckoutScope() === scope;
    await claimCurrentCheckout();
    if (!current()) return null;
    const { data: status } = await readCheckoutStatus(captured.orderToken!);
    if (!current()) return null;
    if (!status) throw new Error('Payment status is temporarily unavailable.');
    return status;
  }, []);

  const checkStatus = useCallback(async () => {
    if (!activeCheckout) return;
    const attempt = captureCheckoutAttempt(activeCheckout.orderToken);
    if (!attempt) return;

    setIsChecking(true);
    try {
      const status = await loadStatus(attempt);
      if (!status) return;
      setUnpaid(canStartSeparateCheckout(attempt, status) ? status : null);
      setConfirmSeparate(null);
      const shouldOpenConfirmation =
        status.customerRecoveryStatus === 'paid_unresolved' ||
        CONFIRMATION_STATUSES.has(status.status);

      if (shouldOpenConfirmation) {
        setCheckoutAttemptStage(attempt, 'confirmation_opened');
        push(`/shop/checkout/confirmation/${encodeURIComponent(activeCheckout.orderToken)}`);
        return;
      }

      setStatusMessage(
        canStartSeparateCheckout(attempt, status)
          ? 'The earlier checkout is awaiting payment approval. Continue it, or explicitly start a separate order with your current cart.'
          : 'The earlier payment still needs review. Open its order status before starting another order.',
      );
    } catch {
      if (!isCurrentCheckoutAttempt(attempt)) return;
      errorToast({
        header: 'Status check failed',
        message:
          'We could not check this payment yet. Keep its reference and try again before paying.',
      });
    } finally {
      setIsChecking(false);
    }
  }, [activeCheckout, loadStatus, push]);

  const confirmNewOrder = async () => {
    if (!attempt || confirmSeparate !== attempt.orderToken) return;
    const captured = { ...attempt };
    setIsChecking(true);
    try {
      const status = await loadStatus(captured);
      if (!status) return;
      if (!startSeparateCheckout(captured, status)) {
        setUnpaid(null);
        setConfirmSeparate(null);
        setStatusMessage(
          'This payment still needs review. Check its order status before starting another order.',
        );
        return;
      }
      onStartSeparateOrder?.();
      await flushCheckoutStorage('paypal-intent-store');
    } catch {
      if (isCurrentCheckoutAttempt(captured))
        setStatusMessage(
          'We could not confirm that this checkout is unpaid. Check its status before starting another order.',
        );
    } finally {
      setIsChecking(false);
    }
  };

  if (!activeCheckout) return null;

  return (
    <div className='min-w-0 text-white'>
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
          </div>

          {statusMessage && (
            <p role='status' className='mt-3 text-sm leading-6 text-white/80'>
              {statusMessage}
            </p>
          )}
          {attempt && unpaid && canStartSeparateCheckout(attempt, unpaid) && (
            <div className='mt-3 rounded-xl border border-white/20 p-3 text-sm leading-6'>
              {confirmSeparate === attempt.orderToken ? (
                <>
                  <p>
                    Start a separate order with your current cart? You’ll review its items and total
                    again before paying.
                  </p>
                  <button
                    type='button'
                    onClick={confirmNewOrder}
                    disabled={isChecking}
                    className='mt-2 min-h-11 font-semibold underline'
                  >
                    Yes, review a separate order
                  </button>
                  <button
                    type='button'
                    onClick={() => setConfirmSeparate(null)}
                    disabled={isChecking}
                    className='ml-4 min-h-11 underline'
                  >
                    Keep earlier checkout
                  </button>
                </>
              ) : (
                <button
                  type='button'
                  onClick={() => setConfirmSeparate(attempt.orderToken!)}
                  className='min-h-11 font-semibold underline'
                >
                  Start a separate order
                </button>
              )}
            </div>
          )}
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
            {canReopenCheckoutPayment(activeCheckout.stage) && (
              <Button
                name='Review original purchase'
                onClick={onContinueOriginal}
                disabled={reviewing || isChecking}
                className='h-auto rounded-full border border-white/25 bg-white/[0.045] px-4 py-2 text-xs font-semibold text-white hover:bg-white/[0.08]'
              >
                {reviewing ? 'Opening original purchase…' : 'Review original purchase'}
              </Button>
            )}
            <CustomShopLink
              href={`/shop/checkout/confirmation/${encodeURIComponent(activeCheckout.orderToken)}`}
              className='inline-flex min-h-11 items-center text-xs font-semibold underline'
            >
              Open order status
            </CustomShopLink>
          </div>
        </div>
      </div>
    </div>
  );
}

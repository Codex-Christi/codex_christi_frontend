'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import CustomShopLink from '@/components/UI/Shop/HelperComponents/CustomShopLink';
import { Button } from '@/components/UI/primitives/button';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import errorToast from '@/lib/error-toast';
import { useCartStore } from '@/stores/shop_stores/cartStore';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { useVerifiedEmailsStore } from '@/stores/shop_stores/checkoutStore/useVerifiedEmailsStore';
import { useOrderStringStore } from '@/stores/shop_stores/checkoutStore/ORD-stringStore';
import { usePayPalIntentStore } from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import { useOrderProcessingStore } from '@/stores/shop_stores/checkoutStore/orderProcessingStore';
import {
  mapLedgerToProcessingState,
  type MappedProcessingState,
  type PayPalTxPaymentStatusResponse,
} from '@/lib/paypal/txLedger/mapLedgerToProcessingState';

type PageProps = {
  params: Promise<{ orderToken: string }>;
};

const statusCopy: Record<string, { title: string; description: string }> = {
  processing: {
    title: 'Your payment was received',
    description:
      'We are finishing the follow-up steps on our servers. You can leave this page and come back later.',
  },
  completed: {
    title: 'Payment confirmed',
    description: 'Your transaction is complete and your order is moving forward.',
  },
  error: {
    title: 'This transaction needs review',
    description:
      'Your payment activity was recorded, but a follow-up step needs attention before fulfillment can continue.',
  },
  idle: {
    title: 'Payment status unavailable',
    description:
      'We could not find a recent payment record. Please return to the shop and start again.',
  },
};

const statusIcon = (stepStatus: 'idle' | 'pending' | 'success' | 'error') => {
  if (stepStatus === 'success') return <CheckCircle2 className='text-emerald-300' size={26} />;
  if (stepStatus === 'error') return <AlertCircle className='text-rose-300' size={26} />;
  if (stepStatus === 'pending') return <Loader2 className='text-sky-200 animate-spin' size={24} />;
  return <Loader2 className='text-white/60' size={24} />;
};

const CheckoutConfirmationPage = ({ params }: PageProps) => {
  const routeOrderToken = use(params)?.orderToken;
  const [downloading, setDownloading] = useState(false);
  const [hasHydratedFromLedger, setHasHydratedFromLedger] = useState(false);
  const [processingState, setProcessingState] = useState<MappedProcessingState | null>(null);
  const clearCart = useCartStore((store) => store.clearCart);
  const resetCheckoutToInitial = useShopCheckoutStore((store) => store.resetCheckoutToInitial);
  const clearVerifiedEmails = useVerifiedEmailsStore((store) => store.clearStore);
  const setOrderString = useOrderStringStore((store) => store.setOrderString);
  const clearIntent = usePayPalIntentStore((store) => store.clearIntent);
  const resetProcessingState = useOrderProcessingStore((store) => store.resetProcessingState);
  const flowStatus = processingState?.flowStatus ?? 'processing';
  const steps =
    processingState?.steps ??
    mapLedgerToProcessingState({
      orderToken: routeOrderToken,
      status: 'captured',
    }).steps;
  const receiptLink = processingState?.receiptLink;
  const receiptFileName = processingState?.receiptFileName;
  const orderCustomId = processingState?.orderCustomId;
  const routeErrorMessage = processingState?.errorMessage;
  const currentStatusCopy = statusCopy[flowStatus] ?? statusCopy.idle;
  const canDownloadReceipt = Boolean(receiptLink && receiptFileName);
  const timelineProgress = useMemo(() => {
    const total = steps.length || 1;
    const completed = steps.filter((step) => step.status === 'success').length;
    return Math.round((completed / total) * 100);
  }, [steps]);

  const handleDownLoad = useCallback(async () => {
    try {
      if (!canDownloadReceipt || !receiptLink || !receiptFileName) {
        throw new Error('Receipt is not ready yet.');
      }
      setDownloading(true);
      const directDownload = () => {
        const link = document.createElement('a');
        link.href = receiptLink;
        link.download = `${receiptFileName}.pdf`;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };

      let usedDirect = false;
      try {
        const receiptUrl = new URL(receiptLink, window.location.href);
        if (receiptUrl.origin === window.location.origin) {
          const headRes = await fetch(receiptUrl.toString(), { method: 'HEAD' });
          if (headRes.ok) {
            directDownload();
            usedDirect = true;
          }
        }
      } catch {
        // Ignore HEAD failures and fall back to blob download.
      }

      if (!usedDirect) {
        try {
          const response = await fetch(receiptLink);
          if (!response.ok) throw new Error('Unable to fetch receipt.');
          const blob = await response.blob();
          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = `${receiptFileName}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(downloadUrl);
        } catch {
          // Fall back to a direct link if CORS prevents blob downloads.
          directDownload();
        }
      }
    } catch (err) {
      console.error('Error during download:', err);
      errorToast({
        header: 'Error during download',
        message:
          typeof err === 'string' ? err : err instanceof Error ? err.message : JSON.stringify(err),
      });
    } finally {
      setDownloading(false);
    }
  }, [canDownloadReceipt, receiptFileName, receiptLink]);

  const resetCheckoutRelatedStoresAndVars = useCallback(() => {
    clearIntent();
    resetProcessingState();
    clearVerifiedEmails();
    setOrderString('');
    clearCart();
    resetCheckoutToInitial();
  }, [
    clearCart,
    clearIntent,
    clearVerifiedEmails,
    resetCheckoutToInitial,
    resetProcessingState,
    setOrderString,
  ]);

  useEffect(() => {
    if (!routeOrderToken) return;

    let cancelled = false;
    const intervalMs = 2500;

    const pollLedger = async () => {
      if (cancelled) return;

      try {
        const res = await fetch(
          `/next-api/paypal/tx-ledger/payments/${encodeURIComponent(routeOrderToken)}/status`,
          { cache: 'no-store' },
        );

        if (!res.ok) {
          throw new Error(`Payment status lookup failed: ${res.status}`);
        }

        const data = (await res.json()) as PayPalTxPaymentStatusResponse;
        const nextState = mapLedgerToProcessingState(data);

        if (!cancelled) {
          setProcessingState(nextState);

          // Safe to clear here because the intent/authorize/capture routes have already persisted
          // otpOrderId, cart/shipping snapshots, customer info, and PayPal payloads to the ledger.
          if (!hasHydratedFromLedger) {
            resetCheckoutRelatedStoresAndVars();
            setHasHydratedFromLedger(true);
          }
        }

        if (
          nextState.flowStatus === 'completed' ||
          nextState.flowStatus === 'error' ||
          data.status === 'refunded'
        ) {
          return;
        }
      } catch (err) {
        console.error('Payment status polling error:', err);
      }

      if (!cancelled) {
        window.setTimeout(pollLedger, intervalMs);
      }
    };

    void pollLedger();

    return () => {
      cancelled = true;
    };
  }, [hasHydratedFromLedger, resetCheckoutRelatedStoresAndVars, routeOrderToken]);

  if (!routeOrderToken) {
    return (
      <div className='flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center text-white'>
        <h1 className='text-2xl font-semibold tracking-tight'>We could not find that payment</h1>
        <p className='text-white/70 max-w-lg'>
          If you just completed a payment, wait a moment and try again. Otherwise return to the
          shop and start a fresh checkout.
        </p>
        <CustomShopLink
          href='/shop'
          className='px-6 py-3 rounded-2xl border border-white/20 hover:bg-white/10 transition-colors font-semibold'
        >
          Return to Shop
        </CustomShopLink>
      </div>
    );
  }

  return (
    <div className='!text-white flex flex-col py-4 !font-inter !select-none'>
      <section
        className='bg-[rgba(243,243,243,0.078)] mx-auto w-full max-w-[560px] rounded-3xl 
        backdrop-blur-[30px] flex flex-col items-center py-6 px-5 space-y-7 relative overflow-hidden'
      >
        <div className='w-full flex items-center justify-between text-[0.7rem] uppercase tracking-[0.2em] text-white/60'>
          <span>Confirmation</span>
          <CustomShopLink
            href='/shop'
            className='px-3 py-1.5 rounded-full border border-white/20 font-semibold tracking-wide text-white/80 hover:border-white/40 hover:text-white transition'
          >
            Shop more
          </CustomShopLink>
        </div>
        <motion.div
          className='absolute inset-0 -z-10 opacity-50 blur-3xl'
          animate={{ background: ['#111827', '#172554', '#111827'] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />

        <div className='flex flex-col items-center text-center space-y-4'>
          <motion.div
            className={cn(
              'w-20 h-20 rounded-full border border-white/20 flex items-center justify-center',
              flowStatus === 'completed'
                ? 'bg-emerald-400/10 border-emerald-200/40'
                : flowStatus === 'error'
                  ? 'bg-rose-400/10 border-rose-200/40'
                  : 'bg-white/5',
            )}
            animate={{ scale: flowStatus === 'completed' ? [1, 1.08, 1] : 1 }}
            transition={flowStatus === 'completed' ? { repeat: Infinity, duration: 3 } : undefined}
          >
            {statusIcon(
              flowStatus === 'completed' ? 'success' : flowStatus === 'error' ? 'error' : 'pending',
            )}
          </motion.div>

          <div>
            <p className='text-sm uppercase tracking-[0.2em] text-white/60'>
              Payment Ref #{orderCustomId ?? routeOrderToken.slice(0, 12)}
            </p>
            <h1 className='text-xl font-semibold mt-2'>{currentStatusCopy.title}</h1>
            <p className='text-white/70 mt-2 text-base'>{currentStatusCopy.description}</p>
            {routeErrorMessage ? (
              <p className='text-rose-200 text-sm mt-3'>{routeErrorMessage}</p>
            ) : null}
          </div>
        </div>

        <div className='w-full space-y-2'>
          <div className='flex items-center justify-between text-sm text-white/70'>
            <span>Progress</span>
            <span>{timelineProgress}%</span>
          </div>
          <div className='h-2 w-full rounded-full bg-white/10 overflow-hidden'>
            <motion.div
              className='h-full bg-gradient-to-r from-sky-400 via-violet-400 to-emerald-400'
              initial={{ width: 0 }}
              animate={{ width: `${timelineProgress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        <ul className='w-full space-y-4'>
          {steps.map((step, index) => (
            <motion.li
              key={step.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className='flex gap-3 rounded-2xl border border-white/10 p-3 bg-white/5'
            >
              <div
                className={cn(
                  'flex-shrink-0 rounded-full p-3 border',
                  step.status === 'success'
                    ? 'border-emerald-300/40 bg-emerald-300/10'
                    : step.status === 'error'
                      ? 'border-rose-300/40 bg-rose-300/10'
                      : 'border-white/20 bg-white/5',
                )}
              >
                {statusIcon(step.status)}
              </div>
              <div className='flex flex-col'>
                <div className='flex items-center gap-2'>
                  <p className='font-semibold text-base'>{step.label}</p>
                  <span
                    className={cn(
                      'px-2.5 py-0.5 rounded-full text-xs uppercase tracking-wide',
                      step.status === 'success'
                        ? 'bg-emerald-400/20 text-emerald-200'
                        : step.status === 'error'
                          ? 'bg-rose-400/20 text-rose-200'
                          : step.status === 'pending'
                            ? 'bg-sky-400/20 text-sky-100'
                            : 'bg-white/10 text-white/70',
                    )}
                  >
                    {step.status}
                  </span>
                </div>
                <p className='text-white/70 text-sm mt-1'>{step.description}</p>
                {step.errorMessage && (
                  <p className='text-rose-200 text-sm mt-2'>{step.errorMessage}</p>
                )}
              </div>
            </motion.li>
          ))}
        </ul>

        <div className='w-full space-y-3'>
          <Button
            name='Download Receipt'
            onClick={handleDownLoad}
            disabled={!canDownloadReceipt || downloading}
            className='w-full rounded-2xl border border-white/20 bg-transparent hover:bg-white/10 text-base font-semibold h-auto py-2.5'
          >
            {downloading
              ? 'Preparing receipt...'
              : canDownloadReceipt
                ? 'Download receipt'
                : 'Receipt is generating'}
          </Button>
        </div>
      </section>
    </div>
  );
};

export default CheckoutConfirmationPage;

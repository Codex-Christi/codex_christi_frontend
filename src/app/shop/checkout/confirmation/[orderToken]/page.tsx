'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import CustomShopLink from '@/components/UI/Shop/HelperComponents/CustomShopLink';
import { Button } from '@/components/UI/primitives/button';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Copy, Download, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import errorToast from '@/lib/error-toast';
import successToast from '@/lib/success-toast';
import { useCartStore } from '@/stores/shop_stores/cartStore';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { useVerifiedEmailsStore } from '@/stores/shop_stores/checkoutStore/useVerifiedEmailsStore';
import { useDjangoOrderIntentStore } from '@/stores/shop_stores/checkoutStore/djangoOrderIntentStore';
import { usePayPalIntentStore } from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
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
    title: 'Your payment is safe',
    description:
      'We received your payment successfully, but your order needs a quick manual review before it can move to fulfillment.',
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
  const resetCheckoutToStoreDefaults = useShopCheckoutStore(
    (store) => store.resetCheckoutToStoreDefaults,
  );
  const clearVerifiedEmails = useVerifiedEmailsStore((store) => store.clearStore);
  const clearDjangoOrderIntent = useDjangoOrderIntentStore((store) => store.clearDjangoOrderIntent);
  const activeLocalOrderToken = usePayPalIntentStore((store) => store.orderToken);
  const clearIntent = usePayPalIntentStore((store) => store.clearIntent);
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
  const supportReference = processingState?.supportReference ?? routeOrderToken;
  const needsManualReview = processingState?.needsManualReview ?? false;
  const currentStatusCopy = statusCopy[flowStatus] ?? statusCopy.idle;
  const canDownloadReceipt = Boolean(receiptLink && receiptFileName);
  const timelineProgress = useMemo(() => {
    const total = steps.length || 1;
    const completed = steps.filter((step) => step.status === 'success').length;
    return Math.round((completed / total) * 100);
  }, [steps]);
  const currentStepKey =
    steps.find((step) => step.status === 'error' || step.status === 'pending')?.key ??
    steps[steps.length - 1]?.key;

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
    if (!routeOrderToken || activeLocalOrderToken !== routeOrderToken) return;

    clearIntent();
    clearVerifiedEmails();
    clearDjangoOrderIntent();
    clearCart();
    resetCheckoutToStoreDefaults();
  }, [
    clearCart,
    clearIntent,
    clearDjangoOrderIntent,
    clearVerifiedEmails,
    resetCheckoutToStoreDefaults,
    activeLocalOrderToken,
    routeOrderToken,
  ]);

  const copySupportReference = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(supportReference);
      successToast({ message: 'Support reference copied.' });
    } catch {
      errorToast({ message: 'Unable to copy support reference.' });
    }
  }, [supportReference]);

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

        if (res.status === 404) {
          const nextState = mapLedgerToProcessingState({
            orderToken: routeOrderToken,
            status: 'not_found',
            error: {
              code: 'NOT_FOUND',
              message: 'We could not find a payment record for this confirmation link.',
            },
          });

          if (!cancelled) {
            setProcessingState(nextState);
          }

          return;
        }

        if (!res.ok) {
          throw new Error(`Payment status lookup failed: ${res.status}`);
        }

        const data = (await res.json()) as PayPalTxPaymentStatusResponse;
        const nextState = mapLedgerToProcessingState(data);

        if (!cancelled) {
          setProcessingState(nextState);

          // Safe to clear here because the intent/authorize/capture routes have already persisted
          // Django order intent IDs, cart/shipping snapshots, customer info, and PayPal payloads
          // have already been persisted to the ledger.
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
    <div className='!text-white flex flex-col py-3 sm:py-5 !font-inter !select-none'>
      <section
        className='relative mx-auto flex w-[calc(100%-0.75rem)] max-w-[560px] flex-col items-center overflow-hidden rounded-[1.8rem] border border-white/16 bg-[linear-gradient(145deg,rgba(15,23,42,0.54),rgba(15,23,42,0.46)_48%,rgba(8,15,30,0.5))] px-4 py-5 shadow-[0_28px_90px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.09)] supports-[backdrop-filter]:backdrop-blur-md sm:w-full sm:px-6 sm:py-6 md:max-w-[680px] md:px-7 lg:max-w-[700px]'
      >
        <div className='pointer-events-none absolute inset-0 overflow-hidden'>
          <div className='absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-cyan-200/[0.075] blur-3xl' />
          <div className='absolute -right-20 top-24 h-52 w-52 rounded-full bg-indigo-200/[0.06] blur-3xl' />
          <div className='absolute -bottom-28 left-8 h-52 w-52 rounded-full bg-emerald-200/[0.045] blur-3xl' />
          <div className='absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/28 to-transparent' />
        </div>

        <div className='w-full flex items-center justify-between text-[0.7rem] uppercase tracking-[0.2em] text-white/60'>
          <span>Confirmation</span>
          <CustomShopLink
            href='/shop'
            className='px-3 py-1.5 rounded-full border border-white/20 font-semibold tracking-wide text-white/80 hover:border-white/40 hover:text-white transition'
          >
            Shop more
          </CustomShopLink>
        </div>
        <div className='relative z-10 mt-4 flex flex-col items-center text-center sm:mt-5'>
          <div className='relative flex w-full flex-col items-center justify-center gap-3 md:flex-row md:gap-0'>
            <motion.div
              className={cn(
                'relative flex h-[4.65rem] w-[4.65rem] items-center justify-center rounded-full border sm:h-[5.4rem] sm:w-[5.4rem]',
                flowStatus === 'completed'
                  ? 'border-emerald-200/36 bg-emerald-300/[0.09] shadow-[0_0_36px_rgba(110,231,183,0.1)]'
                  : flowStatus === 'error'
                    ? 'border-rose-200/30 bg-rose-300/[0.07] shadow-[0_0_34px_rgba(251,113,133,0.11)]'
                    : 'border-white/18 bg-white/[0.045]',
              )}
              animate={{ scale: flowStatus === 'completed' ? [1, 1.08, 1] : 1 }}
              transition={flowStatus === 'completed' ? { repeat: Infinity, duration: 3 } : undefined}
            >
              <div className='absolute inset-2 rounded-full border border-white/[0.08]' />
              {statusIcon(
                flowStatus === 'completed' ? 'success' : flowStatus === 'error' ? 'error' : 'pending',
              )}
            </motion.div>

            {canDownloadReceipt ? (
              <button
                type='button'
                onClick={handleDownLoad}
                disabled={downloading}
                className='group relative flex w-[74%] items-center justify-center gap-3 overflow-hidden rounded-full border border-cyan-100/34 bg-[linear-gradient(135deg,rgba(125,211,252,0.16),rgba(255,255,255,0.07))] px-4 py-2.5 text-left text-white shadow-[0_0_26px_rgba(125,211,252,0.12),inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:border-cyan-50/54 hover:bg-[linear-gradient(135deg,rgba(125,211,252,0.22),rgba(255,255,255,0.1))] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto md:absolute md:right-0 lg:-right-8'
                aria-label='Download receipt'
              >
                <span className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent' />
                <span className='pointer-events-none absolute inset-y-0 left-0 w-1/2 -translate-x-full bg-[linear-gradient(110deg,transparent,rgba(186,230,253,0.14),transparent)] transition-transform duration-700 ease-out group-hover:translate-x-[220%]' />
                <span className='relative flex h-8 w-8 items-center justify-center rounded-full border border-cyan-50/24 bg-cyan-50/[0.12] text-cyan-50 shadow-[0_0_16px_rgba(125,211,252,0.12)] transition group-hover:bg-cyan-50/[0.18] group-hover:text-white'>
                  <Download size={15} strokeWidth={2.2} />
                </span>
                <span className='relative hidden pr-1 text-left sm:block'>
                  <span className='block text-[0.6rem] uppercase tracking-[0.18em] text-cyan-50/66'>
                    Receipt
                  </span>
                  <span className='block text-[0.82rem] font-semibold leading-4 text-white'>
                    {downloading ? 'Preparing...' : 'Download'}
                  </span>
                </span>
                <span className='relative pr-1 text-[0.92rem] font-semibold text-white sm:hidden'>
                  {downloading ? 'Preparing receipt...' : 'Download receipt'}
                </span>
              </button>
            ) : null}
          </div>

          <div className='mt-4 sm:mt-5'>
            <p className='text-[0.58rem] uppercase tracking-[0.16em] text-white/28 sm:text-[0.64rem] sm:tracking-[0.2em] sm:text-white/38'>
              Payment Ref #{orderCustomId ?? routeOrderToken.slice(0, 12)}
            </p>
            <h1 className='mt-2 text-[1.35rem] font-semibold tracking-[-0.01em] text-white sm:text-[1.55rem] md:text-[1.75rem]'>
              {currentStatusCopy.title}
            </h1>
            <p className='mx-auto mt-2 max-w-[31rem] text-sm leading-5 text-white/62 sm:text-[0.95rem] sm:leading-6'>
              <span className='sm:hidden'>
                {needsManualReview
                  ? 'Your payment was received. We are reviewing one final step before fulfillment.'
                  : currentStatusCopy.description}
              </span>
              <span className='hidden sm:inline'>{currentStatusCopy.description}</span>
            </p>
            {routeErrorMessage && !needsManualReview ? (
              <p className='text-rose-200 text-sm mt-3'>{routeErrorMessage}</p>
            ) : null}
          </div>
        </div>

        {needsManualReview ? (
          <div className='relative z-10 mt-5 w-full overflow-hidden rounded-[1.1rem] border border-cyan-100/12 bg-[linear-gradient(135deg,rgba(8,47,73,0.14),rgba(15,23,42,0.2)_58%,rgba(30,41,59,0.12))] p-3 text-left shadow-[0_10px_28px_rgba(2,6,23,0.1),inset_0_1px_0_rgba(255,255,255,0.055)] supports-[backdrop-filter]:backdrop-blur-xl sm:mt-6 sm:rounded-[1.35rem] sm:border-cyan-100/18 sm:p-4'>
            <div className='absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/28 to-transparent' />
            <div className='flex gap-3'>
              <div className='mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-100/18 bg-cyan-100/[0.06] sm:h-9 sm:w-9'>
                <ShieldCheck size={16} className='text-sky-100 sm:hidden' />
                <ShieldCheck size={18} className='text-sky-100 hidden sm:block' />
              </div>
              <div className='min-w-0 flex-1'>
                <p className='text-[0.82rem] font-medium text-cyan-50 sm:text-sm'>
                  We are handling this.
                </p>
                <div className='mt-2 flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-black/[0.08] px-3 py-2 sm:mt-2.5 sm:border-white/[0.09] sm:bg-black/[0.12]'>
                  <div className='min-w-0'>
                    <p className='text-[0.58rem] uppercase tracking-[0.2em] text-white/35'>
                      Support reference
                    </p>
                    <p className='mt-0.5 break-all font-mono text-[0.72rem] leading-4 text-white/88 sm:text-xs'>
                      {supportReference}
                    </p>
                  </div>
                  <button
                    type='button'
                    onClick={copySupportReference}
                    className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-white/62 transition hover:border-white/18 hover:bg-white/[0.07] hover:text-white'
                    aria-label='Copy full support reference'
                    title='Copy full support reference'
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className='relative z-10 mt-5 w-full space-y-2 sm:mt-6'>
          <div className='flex items-center justify-between text-[0.72rem] uppercase tracking-[0.17em] text-white/40'>
            <span>Order progress</span>
            <span className='text-white/52'>{timelineProgress}%</span>
          </div>
          <div className='h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]'>
            <motion.div
              className='h-full rounded-full bg-gradient-to-r from-sky-300/90 via-indigo-300/90 to-emerald-300/90 shadow-[0_0_18px_rgba(125,211,252,0.18)]'
              initial={{ width: 0 }}
              animate={{ width: `${timelineProgress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        <ul className='relative z-10 mt-5 w-full space-y-2 sm:mt-6 sm:space-y-3 md:mt-2 md:space-y-0'>
          {steps.map((step, index) => (
            (() => {
              const isCurrentStep = step.key === currentStepKey;
              const isCompactMobileStep = !isCurrentStep && step.status === 'success';

              return (
            <motion.li
              key={step.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                'relative flex gap-3 rounded-[1.05rem] border shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] md:my-2.5 md:rounded-none md:border-0 md:bg-transparent md:px-0 md:py-2.5 md:shadow-none md:after:absolute md:after:right-0 md:after:-bottom-1.5 md:after:left-0 md:after:h-px md:after:bg-white/[0.08] md:after:content-[""]',
                isCompactMobileStep ? 'items-center p-2.5 md:items-start md:p-0' : 'p-3',
                step.status === 'success'
                  ? 'border-emerald-200/[0.11] bg-emerald-300/[0.035]'
                  : step.status === 'error'
                    ? 'border-rose-200/[0.12] bg-rose-300/[0.035]'
                    : 'border-white/[0.08] bg-white/[0.025]',
              )}
            >
              <div
                className={cn(
                  'flex-shrink-0 rounded-full border self-start md:mt-0.5',
                  isCompactMobileStep ? 'p-2 md:p-2.5' : 'p-2.5 sm:p-3',
                  step.status === 'success'
                    ? 'border-emerald-200/26 bg-emerald-200/[0.06]'
                    : step.status === 'error'
                      ? 'border-rose-200/24 bg-rose-200/[0.055]'
                      : 'border-white/14 bg-white/[0.035]',
                )}
              >
                {statusIcon(step.status)}
              </div>
              <div className='flex min-w-0 flex-1 flex-col md:flex-row md:items-start md:justify-between md:gap-5'>
                <div className='min-w-0 md:flex-1'>
                  <div className='flex items-center gap-2'>
                    <p className={cn(
                      'font-medium leading-5 text-white/88 sm:text-base',
                      isCompactMobileStep ? 'text-[0.86rem]' : 'text-[0.9rem]',
                    )}>
                      {step.label}
                    </p>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.12em] sm:text-[0.62rem]',
                        step.status === 'success'
                          ? 'bg-emerald-300/[0.1] text-emerald-100/82'
                          : step.status === 'error'
                            ? 'bg-rose-300/[0.1] text-rose-100/82'
                            : step.status === 'pending'
                              ? 'bg-sky-300/[0.1] text-sky-100/82'
                              : 'bg-white/[0.07] text-white/56',
                      )}
                    >
                      {step.status}
                    </span>
                  </div>
                  <p className={cn(
                    'mt-1 text-[0.76rem] leading-4 text-white/52 sm:text-[0.82rem] sm:leading-5',
                    isCompactMobileStep && 'hidden md:block',
                  )}>
                    {step.description}
                  </p>
                </div>
                {step.errorMessage && (
                  <p className='mt-2 text-[0.76rem] leading-4 text-rose-100/82 sm:text-[0.82rem] sm:leading-5 md:mt-0 md:max-w-[12rem] md:text-right'>
                    {step.errorMessage}
                  </p>
                )}
              </div>
            </motion.li>
              );
            })()
          ))}
        </ul>

        {!canDownloadReceipt ? (
          <div className='relative z-10 mt-5 w-full space-y-3 sm:mt-6'>
            <Button
              name='Download Receipt'
              onClick={handleDownLoad}
              disabled
              className='h-auto w-full rounded-2xl border border-white/[0.12] bg-white/[0.025] py-2.5 text-sm font-medium text-white/48 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] sm:text-base'
            >
              Receipt is generating
            </Button>
          </div>
        ) : null}
      </section>

    </div>
  );
};

export default CheckoutConfirmationPage;

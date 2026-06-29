'use client';

import * as React from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
  DrawerOverlay,
} from '@/components/UI/primitives/drawer';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/UI/primitives/accordion';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/UI/primitives/input-otp';
import { Button } from '@/components/UI/primitives/button';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clipboard,
  Clock3,
  CreditCard,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import errorToast from '@/lib/error-toast';
import { cn } from '@/lib/utils';
import { useVisualViewportHeightCssVar } from '@/lib/hooks/useVisualViewportHeightCssVar';
import {
  usePaidCheckoutRecoveryStore,
  type PaidCheckoutRecoverySummary,
} from '@/stores/shop_stores/checkoutStore/paidCheckoutRecoveryStore';

type PaidCheckoutRecoveryVerifyResponse =
  | {
      ok: true;
      recoveryVerified: true;
      checkouts: PaidCheckoutRecoverySummary[];
    }
  | {
      ok: false;
      message: string;
    };

type PaidCheckoutRecoveryStartResponse =
  | {
      ok: true;
      recoveryRequired: true;
      expiresInMinutes?: number;
      expiresInSeconds?: number;
      resendAvailableInSeconds?: number;
      message?: string;
    }
  | {
      ok: true;
      recoveryRequired: false;
    }
  | {
      ok: false;
      message: string;
    };

type PaidCheckoutRecoveryModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  recipientName?: string;
  expiresInMinutes?: number;
  resendAvailableInSeconds?: number;
  initialVerifiedCheckouts?: PaidCheckoutRecoverySummary[];
  onStartSeparateOrder: () => Promise<void>;
};

export const PaidCheckoutRecoveryModal = (props: PaidCheckoutRecoveryModalProps) => {
  const {
    isOpen,
    onOpenChange,
    email,
    recipientName,
    expiresInMinutes = 10,
    resendAvailableInSeconds = 0,
    initialVerifiedCheckouts = [],
    onStartSeparateOrder,
  } = props;
  const [otp, setOtp] = React.useState('');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [infoMessage, setInfoMessage] = React.useState<string | null>(null);
  const [checkouts, setCheckouts] =
    React.useState<PaidCheckoutRecoverySummary[]>(initialVerifiedCheckouts);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isResending, setIsResending] = React.useState(false);
  const [isContinuing, setIsContinuing] = React.useState(false);
  const [resendCooldown, setResendCooldown] = React.useState(resendAvailableInSeconds);
  const [hasVerifiedRecovery, setHasVerifiedRecovery] = React.useState(
    initialVerifiedCheckouts.length > 0,
  );
  const recoveryVerified = hasVerifiedRecovery;
  const saveVerifiedRecoverySession = usePaidCheckoutRecoveryStore(
    (s) => s.setVerifiedRecoverySession,
  );

  useVisualViewportHeightCssVar(isOpen);

  const resetRecoveryState = React.useCallback(() => {
    setOtp('');
    setErrorMessage(null);
    setInfoMessage(null);
    setCheckouts([]);
    setIsVerifying(false);
    setIsResending(false);
    setIsContinuing(false);
    setHasVerifiedRecovery(false);
    setResendCooldown(resendAvailableInSeconds);
  }, [resendAvailableInSeconds]);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) resetRecoveryState();
      onOpenChange(open);
    },
    [onOpenChange, resetRecoveryState],
  );

  React.useEffect(() => {
    if (!isOpen || resendCooldown <= 0) return;

    const timer = window.setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isOpen, resendCooldown]);

  const verifyRecoveryOtp = React.useCallback(async () => {
    if (otp.length < 6) {
      setErrorMessage('Enter the 6-digit recovery code sent to your email.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const response = await fetch('/next-api/shop/checkout/recovery/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const payload = (await response.json()) as PaidCheckoutRecoveryVerifyResponse;

      if (!response.ok || !payload.ok) {
        setErrorMessage('message' in payload ? payload.message : 'Invalid recovery code.');
        return;
      }

      setCheckouts(payload.checkouts);
      setHasVerifiedRecovery(true);
      saveVerifiedRecoverySession({ email, checkouts: payload.checkouts });
      setOtp('');
    } catch {
      setErrorMessage('Unable to verify the recovery code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  }, [email, otp, saveVerifiedRecoverySession]);

  const resendRecoveryOtp = React.useCallback(async () => {
    if (resendCooldown > 0) return;

    setIsResending(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const response = await fetch('/next-api/shop/checkout/recovery/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, recipientName }),
      });
      const payload = (await response.json()) as PaidCheckoutRecoveryStartResponse;

      if (!response.ok || !payload.ok) {
        setErrorMessage(
          ('message' in payload ? payload.message : undefined) ??
            'Unable to resend recovery code.',
        );
        return;
      }

      if (!payload.recoveryRequired) {
        setErrorMessage('No active checkout recovery case was found for this email.');
        return;
      }

      setInfoMessage(payload.message ?? 'A recovery code has been sent to your email.');
      setResendCooldown(payload.resendAvailableInSeconds ?? 60);
    } catch {
      setErrorMessage('Unable to resend the recovery code. Please try again.');
    } finally {
      setIsResending(false);
    }
  }, [email, recipientName, resendCooldown]);

  const copySupportReference = React.useCallback(async (supportReference: string) => {
    try {
      await navigator.clipboard.writeText(supportReference);
    } catch {
      errorToast({ message: 'Unable to copy support reference.' });
    }
  }, []);

  const copySupportDetails = React.useCallback(async () => {
    if (!checkouts.length) return;

    const details = checkouts
      .map((checkout, index) =>
        [
          `Checkout ${index + 1}`,
          `Reference: ${checkout.supportReference}`,
          `Status: ${checkout.statusLabel}`,
          `Paid: ${checkout.paidAmountLabel ?? 'Payment received'}`,
          `Placed: ${checkout.placedAtLabel}`,
          `Items: ${checkout.itemSummaryLabel ?? 'Not available'}`,
          `Ship to: ${checkout.shippingSummaryLabel ?? 'Not available'}`,
        ].join('\n'),
      )
      .join('\n\n');

    try {
      await navigator.clipboard.writeText(details);
    } catch {
      errorToast({ message: 'Unable to copy support details.' });
    }
  }, [checkouts]);

  const notifySupportPlaceholder = React.useCallback(() => {
    // TODO: Replace this close-only placeholder with the support notification workflow.
    handleOpenChange(false);
  }, [handleOpenChange]);

  const startSeparateOrder = React.useCallback(async () => {
    setIsContinuing(true);
    setErrorMessage(null);

    try {
      await onStartSeparateOrder();
      handleOpenChange(false);
    } catch {
      setErrorMessage('Unable to continue checkout. Please try again.');
    } finally {
      setIsContinuing(false);
    }
  }, [handleOpenChange, onStartSeparateOrder]);

  const primaryCheckout = checkouts[0];
  const hiddenCheckoutCount = Math.max(0, checkouts.length - 1);

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerOverlay className='!bg-[linear-gradient(135deg,rgba(0,0,0,0.26),rgba(8,47,73,0.16),rgba(6,78,59,0.14),rgba(0,0,0,0.28))] !backdrop-blur-[5px]' />
      <DrawerContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className='!fixed !bottom-0 !right-0 !z-[520] flex h-[var(--checkout-modal-vh,100dvh)] min-h-[var(--checkout-modal-vh,100dvh)] w-full items-center justify-center overflow-hidden !rounded-none !border-none bg-transparent px-2 py-2 sm:py-4'
      >
        <div
          aria-hidden='true'
          className='checkout-recovery-backdrop pointer-events-none absolute inset-0 opacity-90 motion-reduce:animate-none'
        />
        <section className='checkout-recovery-panel mx-auto flex max-h-[calc(var(--checkout-modal-vh,100dvh)-1rem)] w-full max-w-md flex-col overflow-hidden rounded-[1.65rem] border border-white/20 bg-[linear-gradient(145deg,rgba(15,23,42,0.78),rgba(2,6,23,0.68)_52%,rgba(6,78,59,0.32))] p-5 text-white shadow-[0_26px_90px_rgba(8,47,73,0.34),0_0_0_1px_rgba(255,255,255,0.06)_inset] supports-[backdrop-filter]:backdrop-blur-xl sm:w-[92vw] sm:max-w-lg sm:rounded-[1.8rem] sm:p-6 md:max-w-2xl lg:max-w-3xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-300 motion-reduce:animate-none'>
          <div
            aria-hidden='true'
            className='pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-200/80 to-transparent'
          />

          <div className='relative flex min-h-0 flex-1 flex-col'>
            <div className='flex items-start justify-between gap-4'>
              <div className='flex items-center gap-3'>
                <div className='size-11 rounded-2xl border border-sky-200/30 bg-sky-300/10 flex items-center justify-center shadow-[0_0_28px_rgba(125,211,252,0.18)]'>
                  {recoveryVerified ? (
                    <ShieldCheck className='text-emerald-200' size={22} />
                  ) : (
                    <AlertTriangle className='text-sky-100' size={22} />
                  )}
                </div>
                <div>
                  <DrawerTitle className='text-lg font-semibold tracking-tight'>
                    Checkout Recovery
                  </DrawerTitle>
                  <DrawerDescription className='text-sm text-white/65 mt-1'>
                    Protecting you from a duplicate payment.
                  </DrawerDescription>
                </div>
              </div>

              <DrawerClose
                className='rounded-full border border-white/15 bg-white/[0.04] p-2 text-white/70 hover:text-white hover:bg-white/12 transition'
                aria-label='Close checkout recovery'
              >
                <X size={18} />
              </DrawerClose>
            </div>

            <div className='mt-6 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1'>
              <div className='rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-inner shadow-white/[0.03]'>
                <p className='text-sm leading-6 text-white/78'>
                  We found a recent checkout issue for{' '}
                  <span className='font-semibold'>{email}</span>. Your payment may already be
                  recorded, so verify your email before starting another checkout for the same
                  purchase.
                </p>
              </div>

              {!recoveryVerified ? (
                <div className='space-y-5'>
                  <div>
                    <p className='text-sm text-white/65'>
                      Enter the recovery code sent to your email. The code expires in{' '}
                      {expiresInMinutes} minutes.
                    </p>
                    <div className='mt-4 flex justify-center'>
                      <InputOTP maxLength={6} value={otp} onChange={setOtp} className='font-otp'>
                        <InputOTPGroup className='gap-3'>
                          {Array.from({ length: 6 }).map((_, i) => (
                            <InputOTPSlot
                              key={i}
                              index={i}
                              className='w-11 h-12 rounded-xl bg-white/5 border border-white/45 text-white text-xl text-center tracking-widest outline-none ring-offset-transparent focus:ring-2 focus:ring-sky-200/40 focus:bg-white/10 transition-all'
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </div>

                  {errorMessage ? (
                    <p className='rounded-xl border border-rose-200/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100'>
                      {errorMessage}
                    </p>
                  ) : null}

                  {infoMessage ? (
                    <p className='rounded-xl border border-sky-200/20 bg-sky-400/10 px-3 py-2 text-sm text-sky-100'>
                      {infoMessage}
                    </p>
                  ) : null}

                  <div className='flex flex-col sm:flex-row gap-3'>
                    <Button
                      name='Verify checkout recovery code'
                      type='button'
                      onClick={verifyRecoveryOtp}
                      disabled={isVerifying}
                      className='rounded-2xl bg-white text-black hover:bg-white/90 font-semibold gap-2 shadow-[0_14px_34px_rgba(255,255,255,0.12)]'
                    >
                      {isVerifying ? (
                        <Loader2 className='animate-spin' size={17} />
                      ) : (
                        <CheckCircle2 size={17} />
                      )}
                      Verify code
                    </Button>
                    <Button
                      name='Resend checkout recovery code'
                      type='button'
                      onClick={resendRecoveryOtp}
                      disabled={isResending || resendCooldown > 0}
                      className='rounded-2xl border border-white/20 bg-transparent hover:bg-white/10 font-semibold gap-2'
                    >
                      {isResending ? (
                        <Loader2 className='animate-spin' size={17} />
                      ) : (
                        <RefreshCw size={17} />
                      )}
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className='flex min-h-0 flex-col gap-4'>
                  <div className='rounded-2xl border border-emerald-200/20 bg-emerald-400/10 p-4'>
                    <p className='font-semibold text-emerald-100'>
                      {primaryCheckout ? 'Payment received' : 'No active recovery case remains'}
                    </p>
                    <p className='mt-2 text-sm text-white/68'>
                      {primaryCheckout
                        ? 'You do not need to pay again for this order. We are reviewing the final order step.'
                        : 'The checkout issue no longer appears unresolved. You can continue with checkout.'}
                    </p>
                  </div>

                  {primaryCheckout ? (
                    <div className='rounded-2xl border border-white/10 bg-white/[0.045] p-3'>
                      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                        <div className='min-w-0'>
                          <p className='text-sm font-semibold text-white/92'>
                            {primaryCheckout.paidAmountLabel ?? 'Payment received'}
                          </p>
                          <p className='mt-1 truncate text-xs text-white/58'>
                            {primaryCheckout.itemSummaryLabel ??
                              `${primaryCheckout.itemCount || 1} item`}
                          </p>
                        </div>
                        <div className='inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200/18 bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold text-emerald-100'>
                          <CreditCard size={13} />
                          Paid
                        </div>
                      </div>

                      <div className='mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3'>
                        <div className='rounded-xl border border-white/10 bg-black/10 p-2.5'>
                          <Clock3 className='mb-1.5 text-violet-100' size={15} />
                          <p className='text-[10px] uppercase text-white/42'>Placed</p>
                          <p className='mt-1 truncate text-xs font-semibold text-white/88'>
                            {primaryCheckout.placedAtLabel}
                          </p>
                        </div>
                        <div className='rounded-xl border border-white/10 bg-black/10 p-2.5'>
                          <Package className='mb-1.5 text-sky-100' size={15} />
                          <p className='text-[10px] uppercase text-white/42'>Items</p>
                          <p className='mt-1 truncate text-xs font-semibold text-white/88'>
                            {primaryCheckout.itemCount || 1}
                          </p>
                        </div>
                        <div className='col-span-2 rounded-xl border border-white/10 bg-black/10 p-2.5 sm:col-span-1'>
                          <p className='text-[10px] uppercase text-white/42'>Ref</p>
                          <div className='mt-1 flex items-center justify-between gap-2'>
                            <p className='truncate text-xs font-semibold text-white/88'>
                              {primaryCheckout.shortSupportReference}
                              {hiddenCheckoutCount ? ` +${hiddenCheckoutCount}` : ''}
                            </p>
                            <button
                              type='button'
                              onClick={() =>
                                copySupportReference(primaryCheckout.supportReference)
                              }
                              className='inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/78 transition hover:bg-white/10 hover:text-white'
                              aria-label='Copy support reference'
                            >
                              <Clipboard size={13} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <Accordion type='single' collapsible className='mt-3'>
                        <AccordionItem value='recovered-order-details' className='border-white/10'>
                          <AccordionTrigger className='rounded-xl px-2 py-3 text-sm font-semibold text-white/78 hover:text-white hover:no-underline'>
                            Order details
                          </AccordionTrigger>
                          <AccordionContent className='space-y-3 px-1 pb-1'>
                            <div className='grid gap-2 sm:grid-cols-2'>
                              <div className='rounded-xl border border-white/10 bg-white/[0.035] p-3'>
                                <MapPin className='mb-2 text-cyan-100' size={16} />
                                <p className='text-[11px] uppercase text-white/42'>Ship to</p>
                                <p className='mt-1 text-sm font-semibold text-white/88'>
                                  {primaryCheckout.shippingSummaryLabel ?? 'On file'}
                                </p>
                              </div>
                              <div className='rounded-xl border border-white/10 bg-white/[0.035] p-3'>
                                <CheckCircle2 className='mb-2 text-emerald-100' size={16} />
                                <p className='text-[11px] uppercase text-white/42'>Status</p>
                                <p className='mt-1 text-sm font-semibold text-white/88'>
                                  {primaryCheckout.statusLabel}
                                </p>
                              </div>
                            </div>

                            {primaryCheckout.itemTitles.length ? (
                              <div className='rounded-xl border border-white/10 bg-white/[0.035] p-3'>
                                <p className='text-[11px] uppercase text-white/42'>Items</p>
                                <p className='mt-1 text-sm leading-5 text-white/78'>
                                  {primaryCheckout.itemTitles.join(', ')}
                                </p>
                              </div>
                            ) : null}

                            {checkouts.length > 1 ? (
                              <div className='rounded-xl border border-white/10 bg-white/[0.035] p-3'>
                                <p className='text-[11px] uppercase text-white/42'>
                                  Other recovered checkouts
                                </p>
                                <div className='mt-2 space-y-1.5'>
                                  {checkouts.slice(1).map((checkout) => (
                                    <p
                                      key={checkout.orderToken}
                                      className='truncate text-xs text-white/68'
                                    >
                                      {checkout.shortSupportReference} ·{' '}
                                      {checkout.paidAmountLabel ?? checkout.statusLabel}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {primaryCheckout.receiptLink ? (
                              <a
                                href={primaryCheckout.receiptLink}
                                target='_blank'
                                rel='noreferrer'
                                className='inline-flex text-sm font-semibold text-sky-100 underline underline-offset-4'
                              >
                                View receipt
                              </a>
                            ) : null}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  ) : null}

                  {errorMessage ? (
                    <p className='rounded-xl border border-rose-200/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100'>
                      {errorMessage}
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            {recoveryVerified ? (
              <div className='sticky bottom-0 -mx-5 mt-4 border-t border-white/10 bg-slate-950/75 px-5 pt-4 pb-1 supports-[backdrop-filter]:backdrop-blur-xl sm:-mx-6 sm:px-6'>
                <div className='grid grid-cols-2 gap-3'>
                  {checkouts.length ? (
                    <>
                      <Button
                        name='Notify support about recovered checkout'
                        type='button'
                        onClick={notifySupportPlaceholder}
                        className='col-span-2 rounded-2xl bg-white text-black hover:bg-white/90 font-semibold gap-2'
                      >
                        <BellRing size={17} />
                        Notify support
                      </Button>
                      <Button
                        name='Copy checkout recovery support details'
                        type='button'
                        onClick={copySupportDetails}
                        className='rounded-2xl border border-white/20 bg-transparent hover:bg-white/10 font-semibold gap-2'
                      >
                        <Clipboard size={17} />
                        Copy details
                      </Button>
                    </>
                  ) : null}
                  <Button
                    name='Start a new order after checkout recovery'
                    type='button'
                    onClick={startSeparateOrder}
                    disabled={isContinuing}
                    className={cn(
                      'rounded-2xl border border-white/20 bg-transparent hover:bg-white/10 font-semibold gap-2',
                      checkouts.length ? 'text-white/78' : 'col-span-2',
                      isContinuing && 'opacity-70',
                    )}
                  >
                    {isContinuing ? <Loader2 className='animate-spin' size={17} /> : null}
                    {checkouts.length ? 'New order' : 'Continue checkout'}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <style jsx>{`
            .checkout-recovery-backdrop {
              animation: checkout-recovery-backdrop 12s ease-in-out infinite alternate;
              background:
                linear-gradient(115deg, rgba(14, 165, 233, 0.12), transparent 34%),
                linear-gradient(245deg, rgba(16, 185, 129, 0.12), transparent 42%),
                linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 32%);
            }

            .checkout-recovery-panel {
              animation: checkout-recovery-panel 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
            }

            @keyframes checkout-recovery-backdrop {
              from {
                opacity: 0.55;
              }
              to {
                opacity: 0.8;
              }
            }

            @keyframes checkout-recovery-panel {
              from {
                opacity: 0;
                transform: translateY(14px) scale(0.98);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }

            @media (prefers-reduced-motion: reduce) {
              .checkout-recovery-backdrop,
              .checkout-recovery-panel {
                animation: none;
              }
            }
          `}</style>
        </section>
      </DrawerContent>
    </Drawer>
  );
};

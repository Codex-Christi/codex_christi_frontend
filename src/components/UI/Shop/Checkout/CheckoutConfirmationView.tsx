'use client';

import type { ReactNode } from 'react';
import { Check, Copy, Download, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import type { MappedProcessingState } from '@/lib/paypal/txLedger/mapLedgerToProcessingState';

type CheckoutConfirmationViewProps = {
  orderToken: string;
  state: MappedProcessingState | null;
  paid: boolean;
  hasData: boolean;
  accessRequired?: boolean;
  refunded?: boolean;
  lookupError?: string | null;
  cartError?: string | null;
  refreshing?: boolean;
  downloading?: boolean;
  downloadError?: string | null;
  copied?: boolean;
  actionsDisabled?: boolean;
  storageNotice?: ReactNode;
  recovery?: ReactNode;
  onRefresh: () => void;
  onDownload: () => void;
  onCopy: () => void;
};

export default function CheckoutConfirmationView({
  orderToken,
  state,
  paid,
  hasData,
  accessRequired,
  refunded,
  lookupError,
  cartError,
  refreshing,
  downloading,
  downloadError,
  copied,
  actionsDisabled,
  storageNotice,
  recovery,
  onRefresh,
  onDownload,
  onCopy,
}: CheckoutConfirmationViewProps) {
  const completed = state?.flowStatus === 'completed' && paid;
  const manualReview = state?.needsManualReview;
  const title = accessRequired
    ? 'View your order'
    : refunded
      ? 'Payment refunded'
      : completed
        ? 'Thank you for your purchase'
        : manualReview && paid
          ? 'Payment received — order under review'
          : paid
            ? 'Payment received'
            : hasData
              ? 'Payment not confirmed yet'
              : 'Checking your payment';
  const description = completed
    ? `Order #${state?.orderCustomId ?? orderToken.slice(0, 12)} has been confirmed.`
    : refunded
      ? 'This payment has been refunded. Keep your reference for any follow-up.'
      : manualReview
        ? 'Your order needs a final check before it can move forward. Keep the reference below.'
        : paid
          ? 'We’re preparing your receipt and completing the order. You can return to this page to check its progress.'
          : accessRequired
            ? 'Verify the checkout email or sign in to the account used for this order.'
            : hasData
              ? 'We haven’t confirmed a completed payment. If you approved it, check its status before paying again.'
              : 'Please wait while we check the payment record.';

  return (
    <main className='mx-auto flex w-full min-w-0 max-w-2xl flex-col px-3 py-8 text-white sm:px-5 sm:py-12'>
      <section
        aria-labelledby='checkout-confirmation-title'
        className='min-w-0 rounded-2xl bg-[#202020]/95 p-5 text-center sm:p-8'
      >
        {storageNotice}
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${completed ? 'bg-[#0085ff]' : manualReview || refunded ? 'bg-amber-100/10 text-amber-100' : 'bg-white/5 text-sky-200'}`}
        >
          {completed ? (
            <Check size={32} aria-hidden='true' />
          ) : manualReview || refunded || accessRequired ? (
            <TriangleAlert size={28} aria-hidden='true' />
          ) : (
            <Loader2 size={28} className={refreshing ? 'animate-spin' : ''} aria-hidden='true' />
          )}
        </div>
        <h1 id='checkout-confirmation-title' className='mt-5 text-xl font-semibold sm:text-2xl'>
          {title}
        </h1>
        <p className='mx-auto mt-3 max-w-lg text-sm leading-6 text-white/75' aria-live='polite'>
          {description}
        </p>
        {state?.paidAmountLabel && (
          <p className='mt-3 font-semibold'>
            {refunded ? 'Payment amount' : 'Paid'} {state.paidAmountLabel}
          </p>
        )}
        {(lookupError || cartError) && (
          <div
            role='alert'
            className='mt-5 rounded-xl border border-amber-200/30 p-3 text-left text-sm leading-6 text-amber-100'
          >
            <p>{cartError ?? lookupError}</p>
            <button
              type='button'
              onClick={onRefresh}
              disabled={refreshing || actionsDisabled}
              className='mt-2 inline-flex min-h-11 items-center gap-2 font-semibold underline'
            >
              <RefreshCw size={16} aria-hidden='true' /> Try again
            </button>
          </div>
        )}
        {accessRequired && recovery}
        {!accessRequired && (
          <div className='mt-6 grid gap-3'>
            <button
              type='button'
              onClick={onRefresh}
              disabled={refreshing || actionsDisabled}
              className='inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0085ff] px-4 font-semibold disabled:opacity-60'
            >
              {refreshing ? (
                <Loader2 size={17} className='animate-spin' aria-hidden='true' />
              ) : (
                <RefreshCw size={17} aria-hidden='true' />
              )}
              Check order status
            </button>
            <button
              type='button'
              onClick={onDownload}
              disabled={
                actionsDisabled || downloading || !state?.receiptLink || !state.receiptFileName
              }
              className='inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/50 px-4 font-semibold disabled:opacity-45'
            >
              <Download size={17} aria-hidden='true' />
              {downloading
                ? 'Preparing receipt…'
                : state?.receiptLink
                  ? 'Download receipt'
                  : 'Receipt not ready yet'}
            </button>
            {downloadError && (
              <p role='alert' className='text-sm text-amber-100'>
                {downloadError}{' '}
                <a
                  href={state?.receiptLink}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='underline'
                >
                  Open receipt
                </a>
              </p>
            )}
          </div>
        )}
        {state && (
          <details className='mt-5 border-t border-white/15 pt-4 text-left'>
            <summary className='cursor-pointer py-2 text-sm font-medium text-white/75'>
              Order progress
            </summary>
            <ul className='mt-3 space-y-3'>
              {state.steps.map((step) => (
                <li
                  key={step.key}
                  className='flex min-w-0 items-center justify-between gap-3 text-sm'
                >
                  <span>{step.label}</span>
                  <span
                    className={
                      step.status === 'success'
                        ? 'text-emerald-200'
                        : step.status === 'error'
                          ? 'text-amber-100'
                          : 'text-white/55'
                    }
                  >
                    {step.status === 'success'
                      ? 'Done'
                      : step.status === 'error'
                        ? 'Needs attention'
                        : step.status === 'pending'
                          ? 'In progress'
                          : 'Pending'}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className='mt-5 flex min-w-0 items-start justify-between gap-3 rounded-xl border border-white/15 p-3 text-left'>
          <div className='min-w-0'>
            <p className='text-xs text-white/55'>Order reference</p>
            <p className='mt-1 break-all font-mono text-xs leading-5'>
              {state?.supportReference ?? orderToken}
            </p>
          </div>
          <button
            type='button'
            aria-label='Copy order reference'
            disabled={actionsDisabled}
            onClick={onCopy}
            className='flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/25'
          >
            {copied ? (
              <Check size={17} aria-hidden='true' />
            ) : (
              <Copy size={17} aria-hidden='true' />
            )}
          </button>
        </div>
        <CustomShopLink
          href='/shop'
          className='mt-5 inline-flex min-h-11 items-center text-sm text-white/75 underline underline-offset-4'
        >
          Continue shopping
        </CustomShopLink>
      </section>
    </main>
  );
}

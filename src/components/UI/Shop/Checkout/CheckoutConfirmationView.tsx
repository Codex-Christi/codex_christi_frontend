'use client';

import { checkoutPanelClassName } from './checkoutStyles';

import type { ReactNode } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  Link2Off,
  Loader2,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import type { MappedProcessingState } from '@/lib/paypal/txLedger/mapLedgerToProcessingState';
import type { CustomerAddressCorrectionState } from '@/lib/shop/checkout/customerAddressCorrection';
import { customerFulfillmentHold } from '@/lib/shop/checkout/customerFulfillmentHold';
import {
  customerPostPurchaseDescriptions,
  customerPostPurchaseTitles,
} from '@/lib/shop/checkout/customerPostPurchaseStage';

type CheckoutConfirmationViewProps = {
  orderToken: string;
  state: MappedProcessingState | null;
  paid: boolean;
  hasData: boolean;
  accessRequired?: boolean;
  orderNotFound?: boolean;
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
  addressCorrection?: ReactNode;
  addressCorrectionState?: CustomerAddressCorrectionState;
  onRefresh: () => void;
  onDownload: () => void;
  onCopy: () => void;
};

const UTC_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function readLastUpdated(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value)) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const [base, fraction = ''] = value.slice(0, -1).split('.');
  const dateTime = date.toISOString();
  if (dateTime !== `${base}.${fraction.padEnd(3, '0')}Z`) return null;
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  return {
    dateTime,
    label: `${date.getUTCDate()} ${UTC_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${hour}:${minute} UTC`,
  };
}

export default function CheckoutConfirmationView({
  orderToken,
  state: currentState,
  paid: currentPaid,
  hasData: currentHasData,
  accessRequired: requiresAccess,
  orderNotFound,
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
  addressCorrection,
  addressCorrectionState,
  onRefresh,
  onDownload,
  onCopy,
}: CheckoutConfirmationViewProps) {
  const accessRequired = Boolean(requiresAccess) && !orderNotFound;
  const hasData = currentHasData && !accessRequired && !orderNotFound;
  const state = hasData ? currentState : null;
  const paid = hasData && currentPaid;
  const completed = state?.flowStatus === 'completed' && paid && !refunded && !accessRequired;
  const manualReview = state?.needsManualReview;
  const delayed = paid && state?.flowStatus === 'error';
  const onHold = paid && hasData && !accessRequired && !refunded && state?.fulfillmentOnHold;
  const postPurchaseStage =
    paid && hasData && !accessRequired && !refunded ? state?.postPurchaseStage : null;
  const fulfillmentCanceled = postPurchaseStage === 'fulfillment_canceled';
  const stageTitle = postPurchaseStage ? customerPostPurchaseTitles[postPurchaseStage] : null;
  const stageDescription = postPurchaseStage
    ? customerPostPurchaseDescriptions[postPurchaseStage]
    : null;
  const correction =
    paid && hasData && !accessRequired && !refunded && !onHold && !fulfillmentCanceled
      ? addressCorrectionState
      : null;
  const correctionTitle =
    correction === 'required'
      ? 'Check your delivery address'
      : correction === 'checking'
        ? 'Checking your delivery address'
        : null;
  const correctionDescription =
    correction === 'required'
      ? 'Your payment was received. Please correct your address so we can prepare your order.'
      : correction === 'checking'
        ? 'We received your correction. No action is needed right now.'
        : null;
  const shortReference = state?.shortSupportReference || orderToken.slice(0, 8);
  const fulfillmentCheckedAt = onHold || postPurchaseStage ? state?.fulfillmentCheckedAt : null;
  const lastUpdated =
    !accessRequired && hasData ? readLastUpdated(fulfillmentCheckedAt ?? state?.updatedAt) : null;
  const lookupUnavailable = !hasData && !accessRequired && Boolean(lookupError || orderNotFound);
  const title = orderNotFound
    ? 'Order link unavailable'
    : accessRequired
      ? 'Verify access to this order'
      : refunded
        ? 'Payment refunded'
        : completed
          ? 'Thank you for your purchase'
          : manualReview && paid
            ? 'Payment received — order under review'
            : delayed
              ? 'Payment received — order delayed'
              : paid
                ? 'Payment received'
                : hasData
                  ? 'Payment not confirmed yet'
                  : lookupUnavailable
                    ? 'Order status unavailable'
                    : 'Loading your order';
  const description = orderNotFound
    ? 'This order link isn’t available on this site. Check the link or look in Order History.'
    : accessRequired
      ? 'Use the email address from checkout to get a code and view this order.'
      : refunded
        ? 'This payment has been refunded. Keep your reference for any follow-up.'
        : manualReview
          ? 'Our team needs to check the order before it can move forward. Keep the reference below.'
          : delayed
            ? 'Your payment is recorded, but the next order step has not finished. Check this page before trying another payment.'
            : completed
              ? `Your payment and order details are recorded. Keep reference ${shortReference} for updates.`
              : paid
                ? (state?.recoveryReason ??
                  'Your payment is recorded. We’re completing the remaining order steps. You can return here for updates.')
                : hasData
                  ? 'We haven’t confirmed a completed payment. If you approved it, check its status before paying again.'
                  : lookupUnavailable
                    ? null
                    : 'Please wait while we load the saved order details.';

  return (
    <main className='mx-auto flex w-full min-w-0 max-w-2xl flex-col px-3 py-8 text-white sm:px-5 sm:py-12'>
      <section
        aria-labelledby='checkout-confirmation-title'
        className={`${checkoutPanelClassName} min-w-0 p-5 text-center sm:p-8`}
      >
        {storageNotice}
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${completed && !onHold && !fulfillmentCanceled ? 'bg-[#0085ff]' : manualReview || refunded || onHold || fulfillmentCanceled ? 'bg-amber-100/10 text-amber-100' : 'bg-white/5 text-sky-200'}`}
        >
          {orderNotFound ? (
            <Link2Off size={28} aria-hidden='true' />
          ) : completed && !onHold && !fulfillmentCanceled ? (
            <Check size={32} aria-hidden='true' />
          ) : manualReview ||
            refunded ||
            accessRequired ||
            lookupUnavailable ||
            onHold ||
            fulfillmentCanceled ? (
            <TriangleAlert size={28} aria-hidden='true' />
          ) : (
            <Loader2 size={28} className={refreshing ? 'animate-spin' : ''} aria-hidden='true' />
          )}
        </div>
        <h1 id='checkout-confirmation-title' className='mt-5 text-xl font-semibold sm:text-2xl'>
          {fulfillmentCanceled
            ? stageTitle
            : onHold
              ? customerFulfillmentHold.title
              : (correctionTitle ?? stageTitle ?? title)}
        </h1>
        <p className='mx-auto mt-3 max-w-lg text-sm leading-6 text-white/75' aria-live='polite'>
          {fulfillmentCanceled
            ? stageDescription
            : onHold
              ? customerFulfillmentHold.description
              : (correctionDescription ?? stageDescription ?? description)}
        </p>
        {lastUpdated && (
          <p className='mt-3 text-xs leading-5 text-white/55'>
            {fulfillmentCheckedAt ? 'Fulfillment last checked: ' : 'Last updated: '}
            <time dateTime={lastUpdated.dateTime}>{lastUpdated.label}</time>
          </p>
        )}
        {state?.paidAmountLabel && (
          <p className='mt-3 font-semibold'>
            {refunded ? 'Payment amount' : 'Paid'} {state.paidAmountLabel}
          </p>
        )}
        {!orderNotFound && (lookupError || cartError) && (
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
        {orderNotFound && (
          <CustomShopLink
            href='/shop/account-overview/order-history'
            prefetch={false}
            className='mt-4 inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white'
          >
            View order history <ArrowRight size={16} className='shrink-0' aria-hidden='true' />
          </CustomShopLink>
        )}
        {accessRequired && recovery}
        {correction && <div className='mt-5 text-left'>{addressCorrection}</div>}
        {hasData && (
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
        {state && !fulfillmentCanceled && (
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

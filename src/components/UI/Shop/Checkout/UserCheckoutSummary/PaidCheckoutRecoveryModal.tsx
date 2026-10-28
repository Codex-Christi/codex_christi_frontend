'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/UI/primitives/dialog';
import type { PaidCheckoutRecoverySummary } from '@/lib/shop/checkout/checkoutRecovery/types';
import { publicShopPath } from '@/lib/auth/domain-routing';
import { useHasMounted } from '@/lib/hooks/useHasMounted';
import { checkoutPanelClassName } from '../checkoutStyles';

type PaidCheckoutRecoveryModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  checkouts: PaidCheckoutRecoverySummary[];
  onStartSeparateOrder: () => Promise<void>;
};

/** Only freshly authorized order summaries reach this dialog; it never requests or caches codes. */
export function PaidCheckoutRecoveryModal({
  isOpen,
  onOpenChange,
  checkouts,
  onStartSeparateOrder,
}: PaidCheckoutRecoveryModalProps) {
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operation = useRef(0);
  const mounted = useHasMounted();
  const hostname = mounted ? window.location.hostname : '';

  useEffect(
    () => () => {
      operation.current += 1;
    },
    [],
  );

  const close = useCallback(
    (open: boolean) => {
      if (!open) operation.current += 1;
      onOpenChange(open);
    },
    [onOpenChange],
  );

  const startSeparateOrder = async () => {
    const request = ++operation.current;
    setContinuing(true);
    setError(null);
    try {
      await onStartSeparateOrder();
      if (operation.current === request) close(false);
    } catch (failure) {
      if (operation.current === request)
        setError(
          failure instanceof Error
            ? failure.message
            : 'We couldn’t continue checkout. Please try again.',
        );
    } finally {
      if (operation.current === request) setContinuing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={close}>
      <DialogContent
        className={`${checkoutPanelClassName} z-[520] max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] min-w-0 gap-4 overflow-y-auto border-white/20 p-5 text-white sm:p-6`}
      >
        <ShieldCheck className='text-emerald-200' size={26} aria-hidden='true' />
        <DialogTitle className='pr-6 text-xl leading-7'>
          An earlier order is already paid
        </DialogTitle>
        <DialogDescription className='text-sm leading-6 text-white/75'>
          {checkouts.length === 1
            ? 'Your earlier payment was received. Review that order before making a separate purchase.'
            : 'These earlier payments were received. Review the orders before making a separate purchase.'}
        </DialogDescription>
        <ul className='min-w-0 divide-y divide-white/15'>
          {checkouts.map((checkout) => (
            <li key={checkout.orderToken} className='min-w-0 py-4 first:pt-0'>
              <div className='flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1'>
                <p className='font-semibold'>{checkout.paidAmountLabel ?? 'Payment received'}</p>
                <p className='text-xs text-white/60'>{checkout.placedAtLabel}</p>
              </div>
              <p
                className='mt-2 line-clamp-2 break-words text-sm text-white/85'
                title={checkout.itemTitles.join(', ')}
              >
                {checkout.itemSummaryLabel ?? `${checkout.itemCount} items`}
              </p>
              <p className='mt-2 text-xs text-white/60'>
                {checkout.statusLabel} · Ref {checkout.shortSupportReference}
              </p>
              <a
                href={publicShopPath(
                  `/shop/checkout/confirmation/${encodeURIComponent(checkout.orderToken)}?view=details`,
                  hostname,
                )}
                target='_blank'
                rel='noopener noreferrer'
                className='mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#0085ff] px-4 text-sm font-semibold text-white'
              >
                View earlier order <ExternalLink size={15} aria-hidden='true' />
                <span className='sr-only'>(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
        <div className='border-t border-white/15 pt-4'>
          <p className='mb-3 text-sm leading-6 text-white/75'>
            Continuing starts a separate purchase with another payment.
          </p>
          {error && (
            <p role='alert' className='mb-3 text-sm leading-6 text-amber-100'>
              {error}
            </p>
          )}
          <button
            type='button'
            onClick={() => void startSeparateOrder()}
            disabled={continuing}
            className='inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/50 px-4 text-sm font-semibold disabled:opacity-60'
          >
            {continuing && <Loader2 className='animate-spin' size={16} aria-hidden='true' />}
            Start a separate purchase
          </button>
          <button
            type='button'
            onClick={() => close(false)}
            className='mt-2 min-h-11 w-full px-3 text-sm text-white/75 underline underline-offset-4'
          >
            Back to checkout
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

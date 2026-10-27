'use client';

import Image from 'next/image';
import { AlertTriangle, Check, ChevronDown, CloudOff, LoaderCircle } from 'lucide-react';
import { useId, useState } from 'react';
import { useCartStore } from '@/stores/shop_stores/cartStore';
import { buildOptionSummary, toCartOptions } from './cartOptionHelpers';

type Choice = 'local' | 'remote';

function QuantityChoice({
  source,
  quantity,
  saving,
  disabled,
  onChoose,
}: {
  source: Choice;
  quantity: number;
  saving: boolean;
  disabled: boolean;
  onChoose: () => void;
}) {
  const local = source === 'local';
  const label =
    quantity === 0
      ? local
        ? 'Keep it removed from this device'
        : 'Use the online removal'
      : local
        ? `Keep ${quantity} from this device`
        : `Use ${quantity} saved online`;

  return (
    <button
      type='button'
      aria-label={label}
      disabled={disabled}
      onClick={onChoose}
      className={`relative flex min-h-16 min-w-0 flex-col justify-center gap-1 rounded-xl border px-3 py-2 text-left [overflow-wrap:anywhere] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 disabled:cursor-wait disabled:opacity-60 ${saving ? 'border-amber-100 bg-amber-100/10' : 'border-white/15 bg-black/10 hover:border-amber-200/50 hover:bg-amber-100/5'}`}
    >
      <span className='text-xs text-white/60'>{local ? 'On this device' : 'Saved online'}</span>
      <span className='flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-white'>
        <span className='min-w-0 text-xl font-semibold leading-6'>
          {quantity === 0 ? 'Removed' : quantity}
        </span>
        {quantity > 0 && (
          <span className='text-xs font-medium text-white/75'>
            {local ? 'Keep' : 'Use'} {quantity}
          </span>
        )}
      </span>
      {saving && (
        <LoaderCircle
          aria-hidden='true'
          className='absolute right-2 top-2 size-3.5 animate-spin text-amber-100 motion-reduce:animate-none'
        />
      )}
    </button>
  );
}

export default function CartSyncStatus() {
  const hydrated = useCartStore((state) => state.hydrated);
  const owner = useCartStore((state) => state.owner);
  const status = useCartStore((state) => state.syncStatus);
  const storageError = useCartStore((state) => state.storageError);
  const syncError = useCartStore((state) => state.syncError);
  const conflicts = useCartStore((state) => state.conflicts);
  const retrySync = useCartStore((state) => state.retrySync);
  const resolveConflict = useCartStore((state) => state.resolveConflict);
  const [expanded, setExpanded] = useState(false);
  const [resolving, setResolving] = useState<Record<string, Choice>>({});
  const [error, setError] = useState<string | null>(null);
  const reviewId = useId();
  const hasConflicts = conflicts.length > 0;
  const needsConfirmation = conflicts.some((conflict) => conflict.uncertain);

  async function resolve(variantId: string, choice: Choice) {
    setResolving((current) => ({ ...current, [variantId]: choice }));
    setError(null);
    try {
      await resolveConflict(variantId, choice);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'We could not save your choice. Please try again.',
      );
    } finally {
      setResolving((current) => {
        const next = { ...current };
        delete next[variantId];
        return next;
      });
    }
  }

  async function retry() {
    setError(null);
    try {
      await retrySync();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'We could not reconnect. Please try again.',
      );
    }
  }

  const message = !hydrated
    ? 'Loading your saved cart…'
    : storageError
      ? 'Device storage needs attention. Keep this page open while you retry.'
      : status === 'syncing'
        ? 'Saving your cart online…'
        : status === 'offline'
          ? 'Saved on this device · Waiting to reconnect'
          : status === 'error'
            ? 'Saved on this device · Sync paused'
            : status === 'synced'
              ? 'Saved on this device and online'
              : owner === 'guest'
                ? 'Saved on this device · Sign in to sync'
                : 'Saved on this device';
  const canRetry =
    hydrated && (Boolean(storageError) || status === 'error' || status === 'offline');
  const alert = error || storageError || (!hasConflicts ? syncError : null);

  return (
    <div className='mx-4 mb-5 min-w-0 max-w-full space-y-3 [overflow-wrap:anywhere] sm:mx-5'>
      {hasConflicts ? (
        <section aria-labelledby={`${reviewId}-heading`}>
          <div className='rounded-xl border border-amber-200/30 bg-amber-100/5 px-3 py-2'>
            <div className='grid min-w-0 grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-x-2'>
              <AlertTriangle aria-hidden='true' className='size-[18px] text-amber-200' />
              <h2
                id={`${reviewId}-heading`}
                className='min-w-0 text-sm font-semibold leading-5 text-amber-100'
              >
                {needsConfirmation ? 'Last save not confirmed' : 'Cart updated elsewhere'}
              </h2>
              <button
                type='button'
                aria-label={expanded ? 'Hide comparison' : 'Compare saved quantities'}
                aria-expanded={expanded}
                aria-controls={reviewId}
                onClick={() => setExpanded((current) => !current)}
                className='inline-flex min-h-11 items-center justify-center gap-1 rounded-lg px-2 text-sm font-medium text-amber-100 hover:bg-amber-100/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200'
              >
                {expanded ? 'Hide comparison' : 'Compare'}
                <ChevronDown
                  aria-hidden='true'
                  className={`size-3.5 transition-transform motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
            <p className='pb-1 text-xs leading-5 text-white/65'>
              {needsConfirmation
                ? 'We couldn’t confirm the quantities saved online. Compare the listed items and choose what to keep before checkout.'
                : conflicts.length === 1
                  ? 'One item has different quantities saved on your devices. Compare the affected item before checkout.'
                  : 'Some items have different quantities saved on your devices. Compare the affected items before checkout.'}
            </p>
          </div>
          <div id={reviewId} hidden={!expanded} className='mt-3'>
            <ul className={`grid min-w-0 gap-3 ${conflicts.length > 1 ? 'md:grid-cols-2' : ''}`}>
              {conflicts.map((conflict) => {
                const image =
                  conflict.line?.itemDetail.image || conflict.line?.itemDetail.image_uris?.[0];
                const summary = conflict.line
                  ? buildOptionSummary(toCartOptions(conflict.line.itemDetail.options)).summary
                  : '';
                const pending = resolving[conflict.variantId];
                return (
                  <li
                    key={conflict.variantId}
                    aria-busy={Boolean(pending)}
                    className='min-w-0 rounded-xl border border-white/10 bg-black/10 p-3'
                  >
                    <div className='flex min-w-0 items-center gap-2.5'>
                      {image && (
                        <Image
                          src={image}
                          alt=''
                          width={40}
                          height={40}
                          className='h-10 w-10 shrink-0 rounded-lg object-cover object-top'
                        />
                      )}
                      <div className='min-w-0 flex-1'>
                        <h3 className='line-clamp-2 text-sm font-medium leading-5 text-white'>
                          {conflict.title}
                        </h3>
                        {summary && (
                          <p className='mt-0.5 line-clamp-1 text-xs text-white/55'>{summary}</p>
                        )}
                      </div>
                    </div>
                    {conflict.uncertain ? (
                      <p className='mt-2 text-xs leading-5 text-amber-100/80'>
                        Last online save wasn’t confirmed.
                      </p>
                    ) : (
                      conflict.message && (
                        <p className='mt-2 text-xs leading-5 text-amber-100/80'>
                          {conflict.message}
                        </p>
                      )
                    )}
                    <div className='mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2'>
                      <QuantityChoice
                        source='local'
                        quantity={conflict.localQuantity}
                        disabled={Boolean(pending)}
                        saving={pending === 'local'}
                        onChoose={() => void resolve(conflict.variantId, 'local')}
                      />
                      <QuantityChoice
                        source='remote'
                        quantity={conflict.remoteQuantity}
                        disabled={Boolean(pending)}
                        saving={pending === 'remote'}
                        onChoose={() => void resolve(conflict.variantId, 'remote')}
                      />
                    </div>
                    {pending && (
                      <span role='status' className='sr-only'>
                        Saving your choice for {conflict.title}…
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <details className='group mt-2 text-xs leading-5 text-white/65'>
              <summary className='flex min-h-11 cursor-pointer items-center gap-1 rounded-lg text-white/75 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200'>
                Why am I seeing this?
                <ChevronDown
                  aria-hidden='true'
                  className='size-3 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none'
                />
              </summary>
              <p className='pb-2'>
                {needsConfirmation
                  ? 'The connection was interrupted before we could confirm which quantity was saved online. Choose the quantity you want to use in your cart.'
                  : 'Your cart changed on another device before this device finished saving. Choose one quantity to use in your cart.'}
              </p>
            </details>
          </div>
        </section>
      ) : (
        <div
          className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/65'
          role='status'
        >
          {status === 'syncing' || !hydrated ? (
            <LoaderCircle
              aria-hidden='true'
              className='size-3.5 shrink-0 animate-spin motion-reduce:animate-none'
            />
          ) : storageError || status === 'error' ? (
            <AlertTriangle aria-hidden='true' className='size-3.5 shrink-0 text-amber-200' />
          ) : status === 'offline' ? (
            <CloudOff aria-hidden='true' className='size-3.5 shrink-0' />
          ) : (
            <Check aria-hidden='true' className='size-3.5 shrink-0' />
          )}
          <p className='min-w-0 flex-1'>{message}</p>
          {canRetry && (
            <button
              type='button'
              onClick={() => void retry()}
              className='min-h-11 rounded-lg px-2 text-sm underline underline-offset-4'
            >
              Try again
            </button>
          )}
        </div>
      )}
      {alert && (
        <p role='alert' className='text-xs leading-5 text-amber-100'>
          {alert}
        </p>
      )}
    </div>
  );
}

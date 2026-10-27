'use client';

import { useState, useSyncExternalStore } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import {
  EMPTY_CHECKOUT_STORAGE_ISSUES,
  getCheckoutStorageIssues,
  subscribeCheckoutStorageIssues,
  retryCheckoutStorage,
} from '@/stores/shop_stores/checkoutStore/storage';

export default function CheckoutStorageNotice() {
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState(false);
  const issues = useSyncExternalStore(
    subscribeCheckoutStorageIssues,
    getCheckoutStorageIssues,
    () => EMPTY_CHECKOUT_STORAGE_ISSUES,
  );
  if (!issues.length) return null;
  const hasError = issues.some((issue) => issue.severity === 'error');
  const message = issues.find((issue) => issue.severity === 'error')?.message ?? issues[0].message;
  return (
    <div
      role='alert'
      className='mb-5 rounded-xl border border-amber-200/30 bg-amber-100/5 p-3 text-sm leading-6 text-amber-100'
    >
      <p>{message}</p>
      {hasError && (
        <>
          {retryError && (
            <p className='mt-2'>Saving is still unavailable. Keep this page open and try again.</p>
          )}
          <button
            type='button'
            disabled={retrying}
            onClick={async () => {
              setRetrying(true);
              setRetryError(false);
              try {
                await retryCheckoutStorage();
              } catch {
                setRetryError(true);
              } finally {
                setRetrying(false);
              }
            }}
            className='mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-current px-3 font-semibold disabled:opacity-50'
          >
            {retrying ? (
              <Loader2 size={15} className='animate-spin' aria-hidden='true' />
            ) : (
              <RefreshCw size={15} aria-hidden='true' />
            )}
            {retrying ? 'Retrying…' : 'Retry saving'}
          </button>
        </>
      )}
    </div>
  );
}

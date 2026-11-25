'use client';

import { useState, useTransition } from 'react';
import { Clock3, Loader2 } from 'lucide-react';
import { boundedCheckoutRequest } from '@/lib/hooks/shopHooks/checkout/boundedCheckoutRequest';
import {
  isCustomerRecoveryPending,
  type CustomerRecoveryRequestState,
} from '@/lib/shop/checkout/customerRecoveryRequestState';

const messages: Record<Exclude<CustomerRecoveryRequestState, 'available'>, string> = {
  queued: 'Your request is saved. You can close this page and check back for updates.',
  processing: 'We’re working on your order. You can check back for updates.',
  review_required: 'We need to review this order. Keep your order reference.',
  completed: 'Recovery complete.',
  unavailable: 'We can’t resume this order right now. Contact support with your order reference.',
};

export default function CustomerRecoveryRequest({
  orderToken,
  state,
  onRefresh,
}: {
  orderToken: string;
  state: CustomerRecoveryRequestState;
  onRefresh: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState(false);
  const current = accepted && state === 'available' ? 'queued' : state;

  const requestRecovery = () => {
    setError(false);
    startTransition(async () => {
      try {
        const result = await boundedCheckoutRequest(async (signal) => {
          const response = await fetch(
            `/next-api/shop/checkout/${encodeURIComponent(orderToken)}/request-recovery`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: '{}',
              signal,
            },
          );
          if (!response.ok) throw new Error('Recovery request failed');
          return (await response.json()) as { state?: CustomerRecoveryRequestState };
        });
        setAccepted(isCustomerRecoveryPending(result.state));
        onRefresh();
      } catch {
        setError(true);
        // A response can be lost after the request was saved.
        onRefresh();
      }
    });
  };

  if (current !== 'available') {
    return (
      <p role='status' className='text-sm leading-6 text-white/75'>
        {messages[current]}
      </p>
    );
  }
  return (
    <div className='space-y-2'>
      <button
        type='button'
        disabled={pending}
        onClick={requestRecovery}
        className='inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/50 px-4 font-semibold disabled:opacity-50'
      >
        {pending ? (
          <Loader2 size={17} className='animate-spin' aria-hidden='true' />
        ) : (
          <Clock3 size={17} aria-hidden='true' />
        )}
        Request recovery
      </button>
      {error && (
        <p role='alert' className='text-sm text-amber-100'>
          We couldn’t confirm the request. Check your order status before trying again.
        </p>
      )}
    </div>
  );
}

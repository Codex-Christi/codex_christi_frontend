'use client';

import { useState } from 'react';
import { LogOut, RotateCw } from 'lucide-react';
import { logoutUser } from '@/actions/logout';

type Props = { isRetrying?: boolean } & (
  { onRetry: () => void; retryTo?: never } | { retryTo: string; onRetry?: never }
);

export default function AuthUnavailable({ onRetry, retryTo, isRetrying = false }: Props) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const retrying = isRetrying || navigating;
  const buttonClass = 'inline-flex items-center gap-2 underline disabled:opacity-50';

  return (
    <div role='alert' className='mx-auto min-h-40 py-8 text-center space-y-4'>
      <p>Sign-in is temporarily unavailable. Please try again.</p>
      <div className='flex flex-wrap justify-center gap-6'>
        <button
          type='button'
          disabled={retrying || loggingOut}
          aria-busy={retrying}
          className={buttonClass}
          onClick={() => {
            if (onRetry) onRetry();
            else if (retryTo) {
              setNavigating(true);
              window.location.replace(retryTo);
            }
          }}
        >
          <RotateCw size={16} aria-hidden='true' />
          {retrying ? 'Retrying...' : 'Retry'}
        </button>
        <button
          type='button'
          disabled={loggingOut}
          aria-busy={loggingOut}
          className={buttonClass}
          onClick={async () => {
            setLoggingOut(true);
            try {
              await logoutUser();
            } finally {
              setLoggingOut(false);
            }
          }}
        >
          <LogOut size={16} aria-hidden='true' />
          {loggingOut ? 'Logging out...' : 'Logout'}
        </button>
      </div>
    </div>
  );
}

'use client';

import { RotateCw } from 'lucide-react';

export default function AccountLoadError({
  message,
  retry,
}: {
  message: string | null;
  retry: () => Promise<void>;
}) {
  if (!message) return null;
  return (
    <div role='alert' className='space-y-2 py-4 text-sm'>
      <p>{message}</p>
      <button
        type='button'
        className='inline-flex items-center gap-2 underline'
        onClick={() => {
          void retry();
        }}
      >
        <RotateCw size={16} aria-hidden='true' />
        Retry
      </button>
    </div>
  );
}

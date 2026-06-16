'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { useDeferredClientEnhancement } from '@/lib/hooks/useDeferredClientEnhancement';

type LoadedCountryDropdown = ComponentType<{ initiallyOpen?: boolean }>;

export default function DeferredNavCountryDropdown({ disabled }: { disabled?: boolean }) {
  const { ready, requestReady } = useDeferredClientEnhancement({
    fallbackDelay: 11000,
  });
  const [openWhenReady, setOpenWhenReady] = useState(false);
  const [LoadedDropdown, setLoadedDropdown] = useState<LoadedCountryDropdown | null>(null);

  useEffect(() => {
    if (disabled || !ready || LoadedDropdown) return;

    let cancelled = false;

    void import('./NavCountryDropdownLoaded').then((module) => {
      if (!cancelled) setLoadedDropdown(() => module.default);
    });

    return () => {
      cancelled = true;
    };
  }, [LoadedDropdown, disabled, ready]);

  if (disabled) return null;

  if (LoadedDropdown) {
    return <LoadedDropdown initiallyOpen={openWhenReady} />;
  }

  return (
    <button
      type='button'
      aria-label='Choose storefront country'
      className='hidden h-9 w-[76px] items-center justify-center gap-2 rounded-full border border-white/20 bg-black/60 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 md:inline-flex'
      onPointerMove={requestReady}
      onFocus={requestReady}
      onClick={() => {
        setOpenWhenReady(true);
        requestReady();
      }}
    >
      <svg aria-hidden='true' viewBox='0 0 24 24' className='size-5' fill='none'>
        <circle cx='12' cy='12' r='9' stroke='currentColor' strokeWidth='1.8' />
        <path
          d='M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z'
          stroke='currentColor'
          strokeWidth='1.8'
        />
      </svg>
      <svg aria-hidden='true' viewBox='0 0 24 24' className='size-5' fill='none'>
        <path
          d='m7 10 5 5 5-5'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    </button>
  );
}

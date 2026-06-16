'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { useAfterInitialPageLoad } from '@/lib/hooks/useAfterInitialPageLoad';

type LoadedCountryDropdown = ComponentType;

export default function DeferredNavCountryDropdown({ disabled }: { disabled?: boolean }) {
  const ready = useAfterInitialPageLoad(2200);
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

  if (disabled || !LoadedDropdown) return null;

  return <LoadedDropdown />;
}

'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { useAfterInitialPageLoad } from '@/lib/hooks/useAfterInitialPageLoad';

const EMPTY_PROPS = {};

export default function DeferredCurrencyCookieEffects() {
  const ready = useAfterInitialPageLoad(2200);
  const [Effects, setEffects] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (!ready || Effects) return;

    let cancelled = false;

    void import('./CurrencyCookieEffects').then((module) => {
      if (!cancelled) setEffects(() => module.default);
    });

    return () => {
      cancelled = true;
    };
  }, [Effects, ready]);

  return Effects ? <Effects {...EMPTY_PROPS} /> : null;
}

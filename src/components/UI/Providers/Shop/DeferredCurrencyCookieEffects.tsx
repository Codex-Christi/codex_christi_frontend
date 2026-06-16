'use client';

import { useEffect, useState, type ComponentType } from 'react';
import { useDeferredClientEnhancement } from '@/lib/hooks/useDeferredClientEnhancement';

const EMPTY_PROPS = {};

export default function DeferredCurrencyCookieEffects() {
  const { ready } = useDeferredClientEnhancement({
    fallbackDelay: 7000,
    activateOnInteraction: true,
    activateOnScroll: true,
  });
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

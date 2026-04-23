'use client';

import { useEffect } from 'react';
import { readCurrencyCookieClient } from '@/lib/utils/shop/globalFXProductPrice/cookies/clientCookie';
import { useCurrencyCookie } from '@/lib/utils/shop/globalFXProductPrice/currencyCookieStore';

export function CurrencyCookiePersist() {
  const iso3 = useCurrencyCookie((s) => s.iso3);
  const fx = useCurrencyCookie((s) => s.fx);
  const updatedAt = useCurrencyCookie((s) => s.updatedAt);

  useEffect(() => {
    const existing = readCurrencyCookieClient();
    if (existing?.iso3 || !iso3) return;

    void fetch('/next-api/currency-cookies/bootstrapper', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({
        iso3,
        fx,
        updatedAt: updatedAt || Date.now(),
      }),
    }).catch(() => {});
  }, [fx, iso3, updatedAt]);

  return null;
}

'use client';

import { useEffect } from 'react';
import { getDefaultISO3 } from '@/lib/utils/shop/geo/getDefaultISO3.client';
import { readCurrencyCookieClient } from '@/lib/utils/shop/globalFXProductPrice/cookies/clientCookie';
import { useCurrencyCookie } from '@/lib/utils/shop/globalFXProductPrice/currencyCookieStore';

export function ClientCurrencyBootstrap() {
  const iso3 = useCurrencyCookie((s) => s.iso3);
  const changeCountry = useCurrencyCookie((s) => s.changeCountry);

  useEffect(() => {
    if (readCurrencyCookieClient()?.iso3) return;

    const detectedISO3 = getDefaultISO3();
    if (detectedISO3 && detectedISO3 !== iso3) {
      void changeCountry(detectedISO3);
    }
  }, [changeCountry, iso3]);

  return null;
}

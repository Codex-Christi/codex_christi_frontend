import type { ReactNode } from 'react';
import { CurrencyCookieProvider } from '@/lib/utils/shop/globalFXProductPrice/currencyCookieStore';
import type { CookieStateV1 } from '@/lib/utils/shop/globalFXProductPrice/cookies/currencyCookie';
import DeferredCurrencyCookieEffects from './DeferredCurrencyCookieEffects';

const PUBLIC_USD_STATE: CookieStateV1 = {
  v: 1,
  iso3: 'USA',
  fx: {
    multiplier: 1,
    currency: 'USD',
    currency_symbol: '$',
  },
  updatedAt: 0,
};

export default function PublicCurrencyFXWrapper({ children }: { children: ReactNode }) {
  return (
    <CurrencyCookieProvider serverSideData={PUBLIC_USD_STATE}>
      <DeferredCurrencyCookieEffects />
      {children}
    </CurrencyCookieProvider>
  );
}

// app/layout.tsx  (Server Component)
import type { ReactNode } from 'react';
import { readCurrencyCookieServer } from '@/lib/utils/shop/globalFXProductPrice/cookies/readServer';
import { CurrencyCookieProvider } from '@/lib/utils/shop/globalFXProductPrice/currencyCookieStore'; // ← from the store
import type { CookieStateV1 } from '@/lib/utils/shop/globalFXProductPrice/cookies/currencyCookie';
import { getDollarMultiplier } from '@/actions/shop/general/currencyConvert'; // your server action
import { getDefaultISO3 } from '@/lib/utils/shop/geo/getDefaultISO3.server';
import { CurrencyCookiePersist } from './CurrencyCookiePersist';

async function warmFX(iso3: string): Promise<CookieStateV1['fx']> {
  try {
    // NOTE: the caching window is controlled *inside* getDollarMultiplier's fetch.
    // Set its `next: { revalidate: 8 * 60 * 60 }` there if you want 8h TTL.
    const res = await getDollarMultiplier(iso3);
    return { ...res, ts: Date.now() };
  } catch {
    if (iso3 === 'USA') {
      return { multiplier: 1, currency: 'USD', currency_symbol: '$', ts: Date.now() };
    }
    return undefined;
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const snap = await readCurrencyCookieServer(); // { v, iso3, fx?, updatedAt }
  const iso3 = snap.updatedAt > 0 ? snap.iso3 : await getDefaultISO3();
  const fx = snap.fx ?? (await warmFX(iso3 || 'USA'));

  // Cookie is tiny now: no usdPrices
  const initialForClient: CookieStateV1 = {
    v: 1,
    iso3: iso3 || 'USA',
    fx,
    updatedAt: snap.updatedAt || fx?.ts || 0,
  };

  return (
    <CurrencyCookieProvider serverSideData={initialForClient}>
      <CurrencyCookiePersist />
      {children}
    </CurrencyCookieProvider>
  );
}

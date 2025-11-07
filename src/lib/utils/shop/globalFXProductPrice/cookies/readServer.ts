import { cookies } from 'next/headers';
import { CURRENCY_COOKIE, type CookieStateV1 } from '../cookies/currencyCookie';
import { decryptCookieJSON } from '@/lib/utils/shop/globalFXProductPrice/crypto/cookieCipher';

const FALLBACK: CookieStateV1 = { v: 1, iso3: 'USA', updatedAt: 0 };

export async function readCurrencyCookieServer(): Promise<CookieStateV1> {
  const jar = await cookies();
  const raw = jar.get(CURRENCY_COOKIE)?.value;
  if (!raw) return { ...FALLBACK, updatedAt: Date.now() };

  try {
    const parsed = decryptCookieJSON<CookieStateV1>(raw);
    if (parsed?.v === 1) return parsed;
  } catch (e) {
    console.error('[currency] server cookie decrypt failed', e);
  }
  return { ...FALLBACK, updatedAt: Date.now() };
}

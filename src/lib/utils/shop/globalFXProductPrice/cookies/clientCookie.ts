'use client';

import Cookies from 'js-cookie';
import { CURRENCY_COOKIE, type CookieStateV1 } from '../cookies/currencyCookie';
import { encryptCookieJSON, decryptCookieJSON } from '../crypto/cookieCipher';

export function readCurrencyCookieClient(): CookieStateV1 | null {
  try {
    const raw = Cookies.get(CURRENCY_COOKIE);
    if (!raw) return null;
    const parsed = decryptCookieJSON<CookieStateV1>(raw);
    return parsed?.v === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCurrencyCookieClient(state: CookieStateV1): void {
  try {
    const enc = encryptCookieJSON(state);
    Cookies.set(CURRENCY_COOKIE, enc, {
      sameSite: 'lax',
      expires: 30,
      path: '/',
      // secure: true, // enable on HTTPS
    });
  } catch (e) {
    console.error('[currency] client cookie write failed', e);
  }
}

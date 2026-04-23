import { cookies, headers } from 'next/headers';
import { fetchUserShopProfile } from '@/lib/funcs/user-shop';
import { CURRENCY_COOKIE } from '../globalFXProductPrice/cookies/currencyCookie';
import { decryptCookieJSON } from '@/lib/utils/shop/globalFXProductPrice/crypto/cookieCipher';
import { normalizeCountryToIso3 } from '../checkout/normalizeCountryToIso3';

function resolveHeaderCountry(raw: string | null): string | null {
  const value = raw?.trim().toUpperCase();
  if (!value || value === 'XX' || value === 'T1') return null;
  return normalizeCountryToIso3(value);
}

export async function getDefaultISO3(): Promise<string> {
  const jar = cookies();
  const raw = (await jar).get(CURRENCY_COOKIE)?.value;
  if (raw) {
    try {
      const parsed = decryptCookieJSON<{ iso3?: string }>(raw);
      if (parsed?.iso3) return parsed.iso3.toUpperCase();
    } catch {}
  }

  const profile = await fetchUserShopProfile();
  const profileCountry = normalizeCountryToIso3(profile?.data?.shipping_country ?? null);
  if (profileCountry) return profileCountry;

  const h = headers();
  // Test
  const xCountryCode = (await h).get('x-country-code');
  const cfIpCountry = (await h).get('cf-ipcountry');

  console.log('[country-bootstrap] header candidates', {
    xCountryCode,
    cfIpCountry,
  });
  //

  const headerCountry =
    resolveHeaderCountry((await h).get('x-country-code')) ??
    resolveHeaderCountry((await h).get('cf-ipcountry'));

  // Test 2
  console.log('[country-bootstrap] resolved header country', {
    headerCountry,
  });
  //

  if (headerCountry) return headerCountry;

  return 'USA';
}

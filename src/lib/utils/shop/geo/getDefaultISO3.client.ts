'use client';

import Cookies from 'js-cookie';
import { countries } from 'country-data-list';
import { CURRENCY_COOKIE } from '../globalFXProductPrice/cookies/currencyCookie';
// If you encrypt, swap JSON.parse for your decryptCookieJSON
// import { decryptCookieJSON } from "@/lib/utils/shop/globalFXProductPrice/crypto/cookieCipherClient";

function iso2ToIso3(iso2: string): string | null {
  const hit = countries.all.find((c) => c.alpha2?.toUpperCase() === iso2.toUpperCase());
  return hit?.alpha3?.toUpperCase() ?? null;
}

function detectISO2FromNavigator(): string | null {
  const lang = (navigator.languages?.[0] || navigator.language || '').toUpperCase();
  const match = lang.match(/[-_]([A-Z]{2})$/);
  return match ? match[1] : null;
}

export function getDefaultISO3(): string {
  // 1) currency cookie
  try {
    const raw = Cookies.get(CURRENCY_COOKIE);
    if (raw) {
      // const parsed = decryptCookieJSON<{ iso3?: string }>(raw);
      const parsed = JSON.parse(raw);
      if (parsed?.iso3) return parsed.iso3.toUpperCase();
    }
  } catch {}

  // 2) navigator locale → ISO2 → ISO3
  const iso2 = detectISO2FromNavigator();
  if (iso2) {
    const iso3 = iso2ToIso3(iso2);
    if (iso3) return iso3;
  }

  // 3) fallback
  return 'USA';
}

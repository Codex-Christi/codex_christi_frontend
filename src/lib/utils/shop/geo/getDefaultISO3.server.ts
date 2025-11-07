import { cookies, headers } from 'next/headers';
import { countries } from 'country-data-list';
import { CURRENCY_COOKIE } from '../globalFXProductPrice/cookies/currencyCookie';
import { decryptCookieJSON } from '@/lib/utils/shop/globalFXProductPrice/crypto/cookieCipher';

function iso2ToIso3(iso2: string): string | null {
  const hit = countries.all.find((c) => c.alpha2?.toUpperCase() === iso2.toUpperCase());
  return hit?.alpha3?.toUpperCase() ?? null;
}

function parseAcceptLanguage(h: string | null): string | null {
  if (!h) return null;
  // e.g. "en-US,en;q=0.9,fr-CA;q=0.8"
  const tokens = h.split(',').map((s) => s.trim().split(';')[0]); // take lang-region part
  for (const t of tokens) {
    const m = t.match(/[-_]([A-Za-z]{2})$/); // region code
    if (m) return m[1].toUpperCase();
  }
  return null;
}

export async function getDefaultISO3(): Promise<string> {
  // 1) currency cookie (if present)
  const jar = cookies();
  const raw = (await jar).get(CURRENCY_COOKIE)?.value;
  if (raw) {
    try {
      const parsed = decryptCookieJSON<{ iso3?: string }>(raw);
      if (parsed?.iso3) return parsed.iso3.toUpperCase();
    } catch {}
  }

  // 2) Accept-Language header → ISO2 → ISO3
  const h = headers();
  const iso2 = parseAcceptLanguage((await h).get('accept-language'));
  if (iso2) {
    const iso3 = iso2ToIso3(iso2);
    if (iso3) return iso3;
  }

  // 3) fallback
  return 'USA';
}

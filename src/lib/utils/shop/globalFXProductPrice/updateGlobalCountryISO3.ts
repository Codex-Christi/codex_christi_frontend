// stores/helpers/updateCountryISO3.ts
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { useCurrencyCookie } from './currencyCookieStore';

// lib/fx/updateFX.ts
export async function fetchMultiplier(iso3: string) {
  const res = await fetch(`/next-api/currency/multiplier?code=${encodeURIComponent(iso3)}`, {
    next: { revalidate: 86400 },
    cache: 'force-cache',
  });
  if (!res.ok) throw new Error(`FX fetch failed: ${res.status}`);
  return (await res.json()) as { multiplier: number; currency: string; currency_symbol?: string };
}

/**
 * Update both the checkout store's ISO-3 and the currency cookie store.
 * Triggers FX refresh and persists to the cookie (via currency store).
 */
export async function updateGlobalCountryISO3(nextISO3: string | null) {
  // 1) Update the checkout store
  useShopCheckoutStore.getState().setShippingCountryISO3(nextISO3);

  if (!nextISO3) return;

  // 2) Update currency store + FX
  const currency = useCurrencyCookie.getState();
  if (currency.iso3 !== nextISO3) {
    currency.setISO3(nextISO3);
    try {
      const fx = await fetchMultiplier(nextISO3);
      currency.setFX({ ...fx, ts: Date.now() });
    } catch {
      // optional: toast/retry
    }
  }
}

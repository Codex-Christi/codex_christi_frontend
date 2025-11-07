'use client';

import { createStore } from 'zustand/vanilla';
import { createStoreContext } from 'leo-query';
import { readCurrencyCookieClient, writeCurrencyCookieClient } from './cookies/clientCookie';
import { type CookieStateV1 } from './cookies/currencyCookie';

type Fx = CookieStateV1['fx'];

type State = CookieStateV1 & {
  // helpers
  convertUSDCents: (centsUSD: number) => number;

  // actions
  setISO3: (iso3: string) => void;
  setFX: (fx: Fx) => void;
  changeCountry: (iso3: string) => Promise<void>;
};

function convert(usdCents: number, fx?: Fx) {
  const m = fx?.multiplier ?? 1;
  const major = (usdCents / 100) * m;
  return Math.round(major * 100); // -> cents
}

function createCurrencyCookieStore(initial: CookieStateV1) {
  const store = createStore<State>((set, get) => ({
    ...initial,

    convertUSDCents(cents) {
      return convert(cents, get().fx);
    },

    setISO3(iso3) {
      set({ iso3, updatedAt: Date.now() });
      writeCurrencyCookieClient(get());
    },

    setFX(fx) {
      set({ fx: fx ? { ...fx, ts: Date.now() } : undefined, updatedAt: Date.now() });
      writeCurrencyCookieClient(get());
    },

    async changeCountry(iso3) {
      set({ iso3, updatedAt: Date.now() }); // optimistic
      try {
        const res = await fetch(`/next-api/currency/multiplier?code=${iso3}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const fx = await res.json();
        set({ fx: { ...fx, ts: Date.now() }, updatedAt: Date.now() });
      } catch (e) {
        console.error('[currency] changeCountry failed', e);
      } finally {
        writeCurrencyCookieClient(get());
      }
    },
  }));

  // Adopt fresher cookie if another tab wrote it
  if (typeof window !== 'undefined') {
    const client = readCurrencyCookieClient();
    if (client && client.updatedAt > initial.updatedAt) {
      store.setState({ ...client });
    }
  }

  return store;
}

export const { Provider: CurrencyCookieProvider, useStore: useCurrencyCookie } =
  createStoreContext(createCurrencyCookieStore);

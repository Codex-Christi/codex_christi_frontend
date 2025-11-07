// Tiny cookie: no price maps.
export const CURRENCY_COOKIE = 'cc_currency_v1';

export type CookieStateV1 = {
  v: 1;
  iso3: string; // e.g. 'USA'
  fx?: {
    multiplier: number;
    currency: string;
    currency_symbol?: string;
    ts?: number; // client timestamp when fetched
  };
  updatedAt: number; // epoch ms
};

// /types/currency.ts
export type ISO3Country = string; // "USA" | "CAN" | "GBR" | ...

export type DollarMultiplierOk = {
  multiplier: number; // 1 USD => X in target currency
  currency: string; // e.g. "USD", "EUR", "CAD"
  currency_symbol?: string; // optional (may be missing in fallback)
};

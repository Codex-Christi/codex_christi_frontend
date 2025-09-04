export function symbolFromCurrency(code: string | null): string | null {
  if (!code) return null;
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(1);
    return parts.find((p) => p.type === 'currency')?.value ?? null;
  } catch {
    return null;
  }
}

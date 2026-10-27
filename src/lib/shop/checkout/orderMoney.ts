import {
  PAYPAL_CURRENCY_CODES,
  PAYPAL_ZERO_DIGIT_CURRENCY_CODES,
} from '@/datasets/shop_general/paypal_currency_specifics';

export type OrderCurrencyResolution = { currency: string; multiplier: number };

export type OrderPreviewTotals = OrderCurrencyResolution & {
  retailPriceTotalNum: number;
  shippingPriceNum: number;
  totalPriceNum: number;
  linePricesByVariantId: Record<string, { unitPriceNum: number; lineTotalNum: number }>;
};

export function currencyExponent(currency: string): 0 | 2 {
  return PAYPAL_ZERO_DIGIT_CURRENCY_CODES.includes(
    currency.toUpperCase() as (typeof PAYPAL_ZERO_DIGIT_CURRENCY_CODES)[number],
  )
    ? 0
    : 2;
}

/** Preserve checkout's existing fallback for currencies PayPal cannot accept. */
export function resolveOrderCurrency(conversion: {
  currency?: string;
  multiplier: number;
}): OrderCurrencyResolution {
  const currency = conversion.currency?.trim().toUpperCase() ?? 'USD';
  return PAYPAL_CURRENCY_CODES.includes(currency as (typeof PAYPAL_CURRENCY_CODES)[number])
    ? { currency, multiplier: conversion.multiplier }
    : { currency: 'USD', multiplier: 1 };
}

function factor(resolution: OrderCurrencyResolution) {
  if (!Number.isFinite(resolution.multiplier) || resolution.multiplier <= 0)
    throw new RangeError('Currency conversion is unavailable.');
  return currencyExponent(resolution.currency) === 0 ? 1 : 100;
}

function safeMinor(value: number) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError('Money cannot be represented safely in the order currency.');
  return value;
}

/** Round each converted unit before multiplying its quantity, as PayPal line items require. */
export function unitUsdToMinor(unitPriceUsd: number, resolution: OrderCurrencyResolution) {
  if (!Number.isFinite(unitPriceUsd) || unitPriceUsd < 0)
    throw new RangeError('A current retail price is unavailable.');
  return safeMinor(Math.round(unitPriceUsd * resolution.multiplier * factor(resolution)));
}

export function shippingUsdCentsToMinor(
  totalUsdCents: number,
  resolution: OrderCurrencyResolution,
) {
  safeMinor(totalUsdCents);
  return safeMinor(
    factor(resolution) === 1
      ? Math.round((totalUsdCents / 100) * resolution.multiplier)
      : Math.ceil(totalUsdCents * resolution.multiplier - Number.EPSILON),
  );
}

/** Display projection only: payment still re-resolves and seals the canonical snapshot. */
export function calculateOrderPreviewTotals(
  lines: ReadonlyArray<{ variantId: string; unitPriceUsd: number; quantity: number }>,
  shippingUsdCents: number,
  resolution: OrderCurrencyResolution,
): OrderPreviewTotals {
  const divisor = factor(resolution);
  let subtotalMinor = 0;
  const linePricesByVariantId: OrderPreviewTotals['linePricesByVariantId'] = {};
  for (const line of lines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0)
      throw new RangeError('A positive integer quantity is required.');
    const unitMinor = unitUsdToMinor(line.unitPriceUsd, resolution);
    if (unitMinor <= 0) throw new RangeError('A current retail price is unavailable.');
    const lineMinor = safeMinor(unitMinor * line.quantity);
    subtotalMinor = safeMinor(subtotalMinor + lineMinor);
    linePricesByVariantId[line.variantId] = {
      unitPriceNum: unitMinor / divisor,
      lineTotalNum: lineMinor / divisor,
    };
  }
  const shippingMinor = shippingUsdCentsToMinor(shippingUsdCents, resolution);
  return {
    ...resolution,
    retailPriceTotalNum: subtotalMinor / divisor,
    shippingPriceNum: shippingMinor / divisor,
    totalPriceNum: safeMinor(subtotalMinor + shippingMinor) / divisor,
    linePricesByVariantId,
  };
}

const moneyFormatters = new Map<string, Intl.NumberFormat>();

export function formatOrderMoney(amount: number, currency: string) {
  const code = currency.toUpperCase();
  let formatter = moneyFormatters.get(code);
  if (!formatter) {
    const digits = currencyExponent(code);
    formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    moneyFormatters.set(code, formatter);
  }
  return formatter.format(amount);
}

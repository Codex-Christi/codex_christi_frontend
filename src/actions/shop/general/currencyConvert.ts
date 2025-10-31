'use server';
import { getCurrency } from '@/lib/datasetSearchers/shippingSupportMerchize';
import { EUROZONE_COUNTRIES } from '@/lib/utils/currencyMapSets';
import { cache } from 'react';

export const getDollarMultiplier = cache(async (countryCode: string) => {
  try {
    const code = countryCode.toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      throw new Error('Invalid ISO 3166-1 alpha-3 country code');
    }

    const currencyData = await getCurrency(code);
    let { currency: currencyCode } = currencyData;
    const { currency_symbol } = currencyData;

    if (!currencyCode) {
      throw new Error(`Currency mapping not found for country: ${code}`);
    }

    if (EUROZONE_COUNTRIES.has(code)) {
      currencyCode = 'EUR';
    }

    const response = await fetch(`https://open.er-api.com/v6/latest/USD`, {
      next: { revalidate: 86400 },
    });
    if (!response.ok) throw new Error('API rate limit exceeded');

    const data = await response.json();
    if (data.result !== 'success') {
      throw new Error(`API error: ${data['error-type'] || 'Unknown'}`);
    }

    if (!(currencyCode in data.rates)) {
      throw new Error(`Currency ${currencyCode} not supported`);
    }

    const multiplier: number = data.rates[currencyCode];
    console.debug(`[AUDIT] getDollarMultiplier: 1 USD = ${multiplier} ${currencyCode}`);

    if (multiplier <= 0) {
      console.error(`[AUDIT] Invalid multiplier ${multiplier} for ${currencyCode}`);
    }

    return {
      multiplier,
      currency: currencyCode,
      currency_symbol
    };
  } catch (error) {
    console.error(`Conversion failed for ${countryCode}:`, error);
    // fallback
    return {
      multiplier: 1,
      currency: 'USD',
    };
  }
});

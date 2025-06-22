'use server';
import {
  getCurrency,
  ShippingCountryObj,
} from '@/lib/datasetSearchers/shippingSupportMerchize';
import {
  EUROZONE_COUNTRIES,
  UNSTABLE_CURRENCIES,
} from '@/lib/utils/currencyMapSets';

export async function getDollarMultiplier(
  countryCode: ShippingCountryObj['country_iso3']
) {
  try {
    // Validate and normalize input
    const code = countryCode.toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      throw new Error('Invalid ISO 3166-1 alpha-3 country code');
    }

    // Get currency from map
    const currencyData = await getCurrency(code);
    let { currency: currencyCode } = currencyData;
    const { currency_symbol } = currencyData;

    // Validate currency exists
    if (!currencyCode) {
      throw new Error(`Currency mapping not found for country: ${code}`);
    }

    // Eurozone override
    if (EUROZONE_COUNTRIES.has(code)) {
      currencyCode = 'EUR';
    }

    // Fetch exchange rates with caching
    const response = await fetch(
      `https://open.er-api.com/v6/latest/USD`,
      { next: { revalidate: 86400 } } // 24-hour cache
    );

    if (!response.ok) throw new Error('API rate limit exceeded');

    const data = await response.json();
    if (data.result !== 'success') {
      throw new Error(`API error: ${data['error-type'] || 'Unknown'}`);
    }

    // Validate currency support
    if (!(currencyCode in data.rates)) {
      throw new Error(`Currency ${currencyCode} not supported`);
    }

    // Calculate multiplier (1 USD = X target currency)
    const multiplier: number = data.rates[currencyCode];

    // Handle unstable currencies
    const warnings: string[] = [];
    if (UNSTABLE_CURRENCIES.has(currencyCode)) {
      warnings.push(
        `Currency ${currencyCode} is highly volatile. Rates may be inaccurate.`
      );
    }

    // Special territory notices
    if (code === 'PSE')
      warnings.push('Palestine uses Israeli Shekel (ILS) as primary currency');
    if (code === 'ATA')
      warnings.push('Antarctica uses USD as reference currency');

    return {
      multiplier,
      currency: currencyCode,
      currency_symbol: currency_symbol,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  } catch (error) {
    console.error(`Conversion failed for ${countryCode}:`, error);

    // Fallback to USD for unstable currencies
    if (error instanceof Error && error.message.includes('volatile')) {
      return {
        multiplier: 1,
        currency: 'USD',
        warning: 'Using USD due to unstable currency conditions',
      };
    }

    return {
      error: error instanceof Error ? error.message : 'Unknown error',
      currency: null,
    };
  }
}

'use client';
import { FC, useContext, useMemo } from 'react';

import { CheckoutOptions } from '../PaymentSection';

import dynamic from 'next/dynamic';
import { ServerOrderDetailsContext } from '../ServerOrderDetailsComponent';
import { PAYPAL_CURRENCY_CODES } from '@/datasets/shop_general/paypal_currency_specifics';
import { getPublicPayPalClientId } from '@/lib/paypal/publicPayPalConfig';

// Dynamic components

const PayPalScriptLoader = dynamic(() =>
  import('./PaypalScriptLoader').then((comp) => comp.default),
);
const PayPalCheckoutChildren = dynamic(() =>
  import('./PayPalCheckoutChildren').then((comp) => comp.default),
);

// Provider Script Initializer Options - MADE STATIC
const initialOptions = {
  clientId: getPublicPayPalClientId(),
  'enable-funding': 'venmo',
  'buyer-country': 'US',
  // currency: 'USD',
  intent: 'authorize',
  components: 'buttons,card-fields', // KEEP THIS FIXED
  'data-sdk-integration-source': 'developer-studio',
};

// Main Components
const PaypalMainCheckout: FC<{ mode: CheckoutOptions }> = ({ mode }) => {
  const serverOrderDetails = useContext(ServerOrderDetailsContext);
  const { countrySupport } = serverOrderDetails || {};
  const { country_iso2, currency } = countrySupport?.country || {};

  // Validate currency support; fall back to USD when unknown
  const supportsCurrency = useMemo(
    () =>
      PAYPAL_CURRENCY_CODES.includes((currency ?? 'USD') as (typeof PAYPAL_CURRENCY_CODES)[number]),
    [currency],
  );

  const liveOptions = useMemo(
    () => ({
      ...initialOptions,
      'buyer-country': country_iso2 ?? initialOptions['buyer-country'],
      currency: supportsCurrency ? (currency ?? 'USD') : 'USD',
      intent: (initialOptions.intent ?? 'authorize') as 'authorize' | 'capture',
    }),
    [country_iso2, currency, supportsCurrency],
  );

  return (
    <PayPalScriptLoader options={liveOptions} mode={mode}>
      <PayPalCheckoutChildren mode={mode} />
    </PayPalScriptLoader>
  );
};

export default PaypalMainCheckout;

'use client';
import { FC, useContext, useMemo } from 'react';

import { CheckoutOptions } from '../PaymentSection';

import dynamic from 'next/dynamic';
import { ServerOrderDetailsContext } from '../ServerOrderDetailsComponent';
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
  const { countrySupport, finalPricesWithShippingFee } = serverOrderDetails || {};
  const { country_iso2 } = countrySupport?.country || {};
  const currency = finalPricesWithShippingFee?.currency;

  const liveOptions = useMemo(
    () => ({
      ...initialOptions,
      'buyer-country': country_iso2 ?? initialOptions['buyer-country'],
      currency,
      intent: (initialOptions.intent ?? 'authorize') as 'authorize' | 'capture',
    }),
    [country_iso2, currency],
  );

  if (!currency) return null;

  return (
    <PayPalScriptLoader options={liveOptions} mode={mode}>
      <PayPalCheckoutChildren mode={mode} />
    </PayPalScriptLoader>
  );
};

export default PaypalMainCheckout;

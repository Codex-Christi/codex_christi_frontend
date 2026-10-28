'use client';
import { type FC, useContext, useMemo } from 'react';

import { CheckoutPaymentReviewContext, type CheckoutOptions } from '../PaymentSection';

import dynamic from 'next/dynamic';
import { ServerOrderDetailsContext } from '../ServerOrderDetailsComponent';
import { getPublicPayPalClientId } from '@/lib/paypal/publicPayPalConfig';

const PayPalScriptLoader = dynamic(() =>
  import('./PaypalScriptLoader').then((comp) => comp.default),
);
const PayPalCheckoutChildren = dynamic(() =>
  import('./PayPalCheckoutChildren').then((comp) => comp.default),
);

const initialOptions = {
  clientId: getPublicPayPalClientId(),
  'enable-funding': 'venmo',
  'buyer-country': 'US',
  intent: 'authorize',
  components: 'buttons,card-fields',
  'data-sdk-integration-source': 'developer-studio',
} as const;
const PaypalMainCheckout: FC<{ mode: CheckoutOptions }> = ({ mode }) => {
  const serverOrderDetails = useContext(ServerOrderDetailsContext);
  const { countrySupport, finalPricesWithShippingFee } = serverOrderDetails || {};
  const { country_iso2 } = countrySupport?.country || {};
  const { originalCheckout } = useContext(CheckoutPaymentReviewContext);
  const currency = originalCheckout?.quote.currency ?? finalPricesWithShippingFee?.currency;
  const buyerCountry = originalCheckout?.countryCode ?? country_iso2;

  const liveOptions = useMemo(
    () => ({
      ...initialOptions,
      'buyer-country': buyerCountry ?? initialOptions['buyer-country'],
      currency,
    }),
    [buyerCountry, currency],
  );

  if (!currency) return null;

  return (
    <PayPalScriptLoader options={liveOptions} mode={mode}>
      <PayPalCheckoutChildren mode={mode} />
    </PayPalScriptLoader>
  );
};

export default PaypalMainCheckout;

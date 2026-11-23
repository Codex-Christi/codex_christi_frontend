'use client';
import { type FC, useContext, useMemo, useSyncExternalStore } from 'react';

import { CheckoutPaymentReviewContext, type CheckoutOptions } from '../PaymentSection';

import dynamic from 'next/dynamic';
import { ServerOrderDetailsContext } from '../ServerOrderDetailsComponent';
import { getPublicPayPalOptions } from '@/lib/paypal/publicPayPalConfig';
import { loadPublicRuntimeConfig } from '@/lib/runtime-config/client';
import { usePublicRuntimeConfigStatus } from '@/lib/runtime-config/hooks';
import PayPalLoadingSkeleton from './PayPalLoadingSkeleton';
import CheckoutStorageNotice from '../CheckoutStorageNotice';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { useDjangoOrderIntentStore } from '@/stores/shop_stores/checkoutStore/djangoOrderIntentStore';
import { usePayPalIntentStore } from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import {
  EMPTY_CHECKOUT_STORAGE_ISSUES,
  getCheckoutStorageIssues,
  subscribeCheckoutStorageIssues,
} from '@/stores/shop_stores/checkoutStore/storage';

const PayPalScriptLoader = dynamic(() =>
  import('./PaypalScriptLoader').then((comp) => comp.default),
);
const PayPalCheckoutChildren = dynamic(() =>
  import('./PayPalCheckoutChildren').then((comp) => comp.default),
);

const PaypalMainCheckout: FC<{ mode: CheckoutOptions }> = ({ mode }) => {
  const { config, status } = usePublicRuntimeConfigStatus();
  const checkoutHydrated = useSyncExternalStore(
    useShopCheckoutStore.persist.onFinishHydration,
    useShopCheckoutStore.persist.hasHydrated,
    () => false,
  );
  const verificationHydrated = useSyncExternalStore(
    useDjangoOrderIntentStore.persist.onFinishHydration,
    useDjangoOrderIntentStore.persist.hasHydrated,
    () => false,
  );
  const paymentHydrated = useSyncExternalStore(
    usePayPalIntentStore.persist.onFinishHydration,
    usePayPalIntentStore.persist.hasHydrated,
    () => false,
  );
  const storageIssues = useSyncExternalStore(
    subscribeCheckoutStorageIssues,
    getCheckoutStorageIssues,
    () => EMPTY_CHECKOUT_STORAGE_ISSUES,
  );
  const serverOrderDetails = useContext(ServerOrderDetailsContext);
  const { countrySupport, finalPricesWithShippingFee } = serverOrderDetails || {};
  const { country_iso2 } = countrySupport?.country || {};
  const { originalCheckout } = useContext(CheckoutPaymentReviewContext);
  const currency = originalCheckout?.quote.currency ?? finalPricesWithShippingFee?.currency;
  const buyerCountry = originalCheckout?.countryCode ?? country_iso2;

  const liveOptions = useMemo(
    () => getPublicPayPalOptions(config, currency, buyerCountry),
    [config, buyerCountry, currency],
  );

  if (!currency) return null;
  if (storageIssues.some((issue) => issue.recovery === 'reload'))
    return originalCheckout ? <CheckoutStorageNotice /> : null;
  if (status === 'error') {
    return (
      <div
        role='alert'
        className='space-y-3 rounded-xl border border-amber-200/30 p-4 text-sm text-amber-100'
      >
        <p>The payment options couldn’t load. Check your connection and try again.</p>
        <button
          type='button'
          onClick={() => void loadPublicRuntimeConfig().catch(() => {})}
          className='min-h-11 rounded-lg border border-current px-4 font-semibold'
        >
          Try again
        </button>
      </div>
    );
  }
  if (!liveOptions || !checkoutHydrated || !verificationHydrated || !paymentHydrated)
    return <PayPalLoadingSkeleton mode={mode} />;

  return (
    <PayPalScriptLoader options={liveOptions} mode={mode}>
      <PayPalCheckoutChildren mode={mode} />
    </PayPalScriptLoader>
  );
};

export default PaypalMainCheckout;

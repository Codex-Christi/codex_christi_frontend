import { Spinner } from '@/components/UI/primitives/spinner';
import { PayPalScriptOptions } from '@paypal/paypal-js';
import {
  DISPATCH_ACTION,
  PayPalScriptProvider,
  usePayPalScriptReducer,
} from '@paypal/react-paypal-js';
import { FC, useEffect, useMemo, useRef, useState } from 'react';
import type { CheckoutOptions } from '../PaymentSection';
import PayPalLoadingSkeleton from './PayPalLoadingSkeleton';

// Single namespace for the PayPal JS SDK globals
const PAYPAL_NAMESPACE = 'paypal_sdk_cc' as const;

// Strong type for loader options coming from `liveOptions`
// Note: keys mirror your existing `initialOptions`/`liveOptions` shape
type PayPalLoaderOptions = {
  clientId: string;
  components: string; // e.g., 'buttons,card-fields'
  'enable-funding'?: string; // e.g., 'venmo'
  intent?: 'authorize' | 'capture';
  'buyer-country': string; // ISO2
  currency?: string; // e.g., 'USD'
  'data-sdk-integration-source'?: string; // informational/analytics
};

type PayPalMode = CheckoutOptions;

const areOptionsEqual = (a: PayPalScriptOptions, b: PayPalScriptOptions) =>
  a.clientId === b.clientId &&
  a.components === b.components &&
  a.enableFunding === b.enableFunding &&
  a.intent === b.intent &&
  a.buyerCountry === b.buyerCountry &&
  a.currency === b.currency &&
  a.dataNamespace === b.dataNamespace &&
  a.dataSdkIntegrationSource === b.dataSdkIntegrationSource;

const PayPalScriptGate: FC<{
  options: PayPalScriptOptions;
  children: React.ReactNode;
  mode?: PayPalMode;
}> = ({ options, children, mode }) => {
  const [{ isInitial, isPending, isRejected }, dispatch] = usePayPalScriptReducer();
  const prevOptionsRef = useRef<PayPalScriptOptions | null>(null);
  const shouldLoad = mode === 'card' || mode === 'paypal_buttons';

  useEffect(() => {
    if (!prevOptionsRef.current) {
      prevOptionsRef.current = options;
      return;
    }

    if (!areOptionsEqual(prevOptionsRef.current, options)) {
      dispatch({ type: DISPATCH_ACTION.RESET_OPTIONS, value: options });
      prevOptionsRef.current = options;
    }
  }, [dispatch, options]);

  useEffect(() => {
    if (isInitial && shouldLoad) {
      dispatch({ type: DISPATCH_ACTION.RESET_OPTIONS, value: options });
    }
  }, [dispatch, isInitial, options, shouldLoad]);

  if (isRejected) {
    return (
      <div
        role='alert'
        className='space-y-3 rounded-xl border border-amber-200/30 p-4 text-sm text-amber-100'
      >
        <p>The payment options couldn’t load. Check your connection and try again.</p>
        <button
          type='button'
          onClick={() => dispatch({ type: DISPATCH_ACTION.RESET_OPTIONS, value: options })}
          className='min-h-11 rounded-lg border border-current px-4 font-semibold'
        >
          Try again
        </button>
      </div>
    );
  }
  if (isPending) {
    if (mode === 'card' || mode === 'paypal_buttons') {
      return <PayPalLoadingSkeleton mode={mode} />;
    }
    return (
      <div className='flex items-center justify-center py-4'>
        <Spinner />
        <span className='text-muted-foreground text-sm'>Loading PayPal...</span>
      </div>
    );
  }

  return <>{children}</>;
};

// Provider wrapper that reloads the SDK via resetOptions (no manual loadScript)
const PayPalScriptLoader: FC<{
  options: PayPalLoaderOptions;
  children: React.ReactNode;
  mode?: PayPalMode;
}> = ({ options, children, mode }) => {
  const {
    clientId,
    components,
    intent,
    currency,
    'enable-funding': enableFunding,
    'buyer-country': buyerCountry,
    'data-sdk-integration-source': dataSdkIntegrationSource,
  } = options;

  const nextOptions = useMemo<PayPalScriptOptions>(
    () => ({
      clientId,
      components,
      enableFunding,
      intent,
      buyerCountry,
      currency,
      dataNamespace: PAYPAL_NAMESPACE,
      dataSdkIntegrationSource,
    }),
    [clientId, components, enableFunding, intent, buyerCountry, currency, dataSdkIntegrationSource],
  );
  const [initialOptions] = useState(nextOptions);

  return (
    <PayPalScriptProvider options={initialOptions} deferLoading={true}>
      <PayPalScriptGate options={nextOptions} mode={mode}>
        {children}
      </PayPalScriptGate>
    </PayPalScriptProvider>
  );
};

export default PayPalScriptLoader;

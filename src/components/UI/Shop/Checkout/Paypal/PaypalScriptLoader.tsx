import { Spinner } from '@/components/UI/primitives/spinner';
import { PayPalScriptOptions } from '@paypal/paypal-js';
import {
  DISPATCH_ACTION,
  PayPalScriptProvider,
  ScriptContext,
  usePayPalScriptReducer,
} from '@paypal/react-paypal-js';
import { FC, useContext, useEffect, useMemo, useRef } from 'react';
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

type PayPalMode = 'card' | 'paypal_buttons' | 'google_pay' | '';

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
  const scriptContext = useContext(ScriptContext);
  const loadingStatusErrorMessage = scriptContext?.loadingStatusErrorMessage;
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
      <div className='space-y-2 text-error text-sm'>
        <div>PayPal failed to load. Please refresh or try again.</div>
        {loadingStatusErrorMessage ? <div>{loadingStatusErrorMessage}</div> : null}
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
  const initialOptionsRef = useRef<PayPalScriptOptions | null>(null);
  if (!initialOptionsRef.current) {
    initialOptionsRef.current = nextOptions;
  }

  return (
    <PayPalScriptProvider options={initialOptionsRef.current} deferLoading={true}>
      <PayPalScriptGate options={nextOptions} mode={mode}>
        {children}
      </PayPalScriptGate>
    </PayPalScriptProvider>
  );
};

export default PayPalScriptLoader;

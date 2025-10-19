import { Spinner } from '@/components/UI/primitives/spinner';
import { loadScript, PayPalNamespace, PayPalScriptOptions } from '@paypal/paypal-js';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { FC, useEffect, useRef, useState } from 'react';

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

// A tiny loader that guarantees the SDK script is fully initialized before children render
const PayPalScriptLoader: FC<{ options: PayPalLoaderOptions; children: React.ReactNode }> = ({
  options,
  children,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const retryRef = useRef(0);
  const MAX_RETRIES = 1; // try once more if zoid destroys components

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setError(null);

    const doLoad = () => {
      // Map our options to loadScript expected keys
      const loadOpts: PayPalScriptOptions = {
        clientId: options.clientId,
        components: options.components,
        enableFunding: options['enable-funding'],
        intent: options.intent,
        buyerCountry: options['buyer-country'],
        currency: options.currency,
        dataNamespace: PAYPAL_NAMESPACE,
        dataSdkIntegrationSource: options['data-sdk-integration-source'],
      };

      loadScript(loadOpts)
        .then((ns: PayPalNamespace | null) => {
          if (cancelled) return;
          if (ns?.Buttons) {
            setLoaded(true);
          } else {
            throw new Error('PayPal SDK loaded but Buttons factory is missing');
          }
        })
        .catch((err) => {
          if (cancelled) return;
          console.error('PayPal script load failed:', err);
          setError(err as Error);
        });
    };

    // Global listeners to catch PayPal SDK v5 unhandled exceptions like
    // "Error: zoid destroyed all components"
    const onWindowError = (evt: ErrorEvent) => {
      const msg = String(evt?.error?.message || evt?.message || '');
      if (msg.includes('zoid destroyed all components')) {
        if (!cancelled && retryRef.current < MAX_RETRIES) {
          retryRef.current += 1;
          // Attempt a single retry
          doLoad();
        }
      }
    };

    const onUnhandledRejection = (evt: PromiseRejectionEvent) => {
      const reason = evt?.reason;
      const msg = typeof reason === 'string' ? reason : String(reason?.message || reason || '');
      if (msg.includes('zoid destroyed all components')) {
        if (!cancelled && retryRef.current < MAX_RETRIES) {
          retryRef.current += 1;
          doLoad();
        }
      }
    };

    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    // initial load
    retryRef.current = 0;
    doLoad();

    return () => {
      cancelled = true;
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, [options.clientId, options.components, options.intent, options.currency, options]);

  if (error) {
    return (
      <div className='text-error text-sm'>PayPal failed to load. Please refresh or try again.</div>
    );
  }
  if (!loaded) {
    // Render a loading spinner or placeholder while loading
    return (
      <div className='flex items-center justify-center py-4'>
        <Spinner />
        <span className='text-muted-foreground text-sm'>Loading PayPal...</span>
      </div>
    );
  }

  // Mirror the loadScript options using camelCase for the provider
  const providerOptions: PayPalScriptOptions = {
    clientId: options.clientId,
    components: options.components,
    enableFunding: options['enable-funding'],
    intent: options.intent,
    buyerCountry: options['buyer-country'],
    currency: options.currency,
    dataNamespace: PAYPAL_NAMESPACE,
    dataSdkIntegrationSource: options['data-sdk-integration-source'],
  };

  return <PayPalScriptProvider options={providerOptions}>{children}</PayPalScriptProvider>;
};
export default PayPalScriptLoader;

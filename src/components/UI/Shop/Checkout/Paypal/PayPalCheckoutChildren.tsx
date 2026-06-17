import errorToast from '@/lib/error-toast';
import MyPaypalButtons from './MyPaypalButtons';
import MyPayPalCardFields from './MyPaypalCardFields';
import { FC, useCallback, useContext } from 'react';
import { CheckoutOptions } from '../PaymentSection';
import { useCartStore } from '@/stores/shop_stores/cartStore';
import { ServerOrderDetailsContext } from '../ServerOrderDetailsComponent';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { usePayPalTXApproveCallback } from '@/lib/hooks/shopHooks/checkout/usePayPalTXApproveCallback';
import { usePayPalIntentStore } from '@/stores/shop_stores/checkoutStore/paypalIntentStore';
import { useDjangoOrderIntentStore } from '@/stores/shop_stores/checkoutStore/djangoOrderIntentStore';

const PayPalCheckoutChildren: FC<{ mode: CheckoutOptions }> = (props) => {
  // Props
  const { mode } = props;

  // Hooks
  const cart = useCartStore((store) => store.variants);
  const serverOrderDetails = useContext(ServerOrderDetailsContext);
  const { first_name, last_name, email, delivery_address } = useShopCheckoutStore();
  const { mainPayPalApproveCallback } = usePayPalTXApproveCallback();
  const setIntent = usePayPalIntentStore((store) => store.setIntent);
  const {
    djangoOrderIntentUuid,
    djangoOrderIntentOrderId,
    djangoOrderIntentPayload,
    djangoOrderIntentVerifyPayload,
  } = useDjangoOrderIntentStore();

  // Destructuring
  const { countrySupport } = serverOrderDetails || {};
  const { country_iso2, currency, country_iso3 } = countrySupport?.country || {};

  // Create order async function
  const createOrder = useCallback(async (): Promise<string> => {
    type IntentResponse =
      | {
          data: {
            orderToken: string;
            paypalOrderId: string;
          };
          requestId: string;
        }
      | {
          error: {
            code: string;
            stage: string;
            message: string;
            requestId: string;
            orderToken?: string;
          };
        };

    try {
      console.log('[paypal-ledger.intent.request]', {
        djangoOrderIntentUuid,
        djangoOrderIntentOrderId,
        customerEmail: email,
        delivery_address,
        cartItemCount: cart.length,
      });

      const response = await fetch('/next-api/paypal/tx-ledger/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart,
          customer: {
            name: `${first_name} ${last_name}`,
            email: email ?? 'john@example.com',
          },
          country: country_iso2 ?? 'US',
          country_iso_3: country_iso3 ?? 'USA',
          initialCurrency: currency ?? 'USD',
          delivery_address,
          djangoOrderIntentUuid,
          djangoOrderIntentOrderId,
          djangoOrderIntentPayload,
          djangoOrderIntentVerifyPayload,
        }),
      });

      const payload = (await response.json()) as IntentResponse;

      if (!response.ok || !('data' in payload)) {
        const routeError =
          'error' in payload
            ? payload.error
            : {
                code: 'UNKNOWN_INTENT_ERROR',
                stage: 'intent_response',
                message: 'Failed to create PayPal intent',
                requestId: 'unknown_request_id',
              };

        const error = new Error(routeError.message ?? 'Failed to create PayPal intent');
        error.name =
          routeError.code === 'LIVE_PRICING_UNAVAILABLE'
            ? 'CheckoutLivePricingUnavailableError'
            : 'PayPalIntentError';
        throw error;
      }

      setIntent({ orderToken: payload.data.orderToken });

      return payload.data.paypalOrderId;
    } catch (err: unknown) {
      console.log(err);

      const isLivePricingUnavailable =
        err instanceof Error && err.name === 'CheckoutLivePricingUnavailableError';

      errorToast({
        header: isLivePricingUnavailable
          ? 'Checkout temporarily unavailable'
          : 'Payment setup failed',
        message: err instanceof Error ? err.message : String(err),
      });
      throw new Error('Failed to create PayPal order');
    }
  }, [
    cart,
    country_iso2,
    country_iso3,
    currency,
    delivery_address,
    email,
    first_name,
    last_name,
    djangoOrderIntentUuid,
    djangoOrderIntentOrderId,
    djangoOrderIntentPayload,
    djangoOrderIntentVerifyPayload,
    setIntent,
  ]);

  // Main JSX
  return (
    <div className='w-full mx-auto'>
      <MyPaypalButtons
        mode={mode}
        createOrder={createOrder}
        onApprove={mainPayPalApproveCallback}
      />

      <MyPayPalCardFields
        mode={mode}
        createOrder={createOrder}
        onApprove={mainPayPalApproveCallback}
      />
    </div>
  );
};

export default PayPalCheckoutChildren;

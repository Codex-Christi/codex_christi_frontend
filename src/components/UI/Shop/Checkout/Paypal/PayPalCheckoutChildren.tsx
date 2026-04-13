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
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';
import { useOrderStringStore } from '@/stores/shop_stores/checkoutStore/ORD-stringStore';

const PayPalCheckoutChildren: FC<{ mode: CheckoutOptions }> = (props) => {
  // Props
  const { mode } = props;

  // Hooks
  const cart = useCartStore((store) => store.variants);
  const serverOrderDetails = useContext(ServerOrderDetailsContext);
  const { first_name, last_name, email, delivery_address } = useShopCheckoutStore();
  const { mainPayPalApproveCallback } = usePayPalTXApproveCallback();
  const setIntent = usePayPalIntentStore((store) => store.setIntent);
  const userId = useUserMainProfileStore((store) => store.userMainProfile?.id);
  const otpOrderId = useOrderStringStore((store) => store.orderString);

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
          userId,
          otpOrderId,
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

        throw new Error(`[${routeError.stage}] ${routeError.code} (${routeError.requestId})`);
      }

      setIntent({ orderToken: payload.data.orderToken });

      return payload.data.paypalOrderId;
    } catch (err: unknown) {
      console.log(err);

      errorToast({
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
    otpOrderId,
    setIntent,
    userId,
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

import errorToast from '@/lib/error-toast';
import MyPaypalButtons from './MyPaypalButtons';
import MyPayPalCardFields from './MyPaypalCardFields';
import { FC, useCallback, useContext } from 'react';
import { CheckoutOptions } from '../PaymentSection';
import { encrypt, useCartStore } from '@/stores/shop_stores/cartStore';
import { ServerOrderDetailsContext } from '../ServerOrderDetailsComponent';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';

import { createOrderAction } from '@/actions/shop/paypal/createOrderAction';

import { usePayPalTXApproveCallback } from '@/lib/hooks/shopHooks/checkout/usePayPalTXApproveCallback';

const PayPalCheckoutChildren: FC<{ mode: CheckoutOptions }> = (props) => {
  // Props
  const { mode } = props;

  // Hooks
  const cart = useCartStore((store) => store.variants);
  const serverOrderDetails = useContext(ServerOrderDetailsContext);
  const { first_name, last_name, email, delivery_address } = useShopCheckoutStore();
  const { mainPayPalApproveCallback } = usePayPalTXApproveCallback();

  // Destructuring
  const { countrySupport } = serverOrderDetails || {};
  const { country_iso2, currency, country_iso3 } = countrySupport?.country || {};

  // Create order async function
  const createOrder = useCallback(async (): Promise<string> => {
    try {
      const response = await createOrderAction(
        encrypt(
          JSON.stringify({
            cart,
            customer: {
              name: `${first_name} ${last_name}`,
              email: email ?? 'john@example.com',
            },
            country: country_iso2 ?? 'US',
            country_iso_3: country_iso3 ?? 'USA',
            initialCurrency: currency ?? 'USD',
            delivery_address,
          }),
        ),
      );

      const orderData = typeof response === 'string' ? JSON.parse(response) : response;

      if (orderData.id) {
        return orderData.id as string;
      } else {
        type PaypalErrorDetail = { description: string; issue: string };
        type PaypalErrorResponse = {
          details: PaypalErrorDetail[];
          links: { href: string }[];
          debug_id: string;
        };

        const statCode = orderData.statusCode as number;

        if (typeof orderData === 'object' && statCode >= 400 && statCode <= 499) {
          const {
            details: [errorDetail, ,],
            links: [{ href }],
            debug_id,
          } = JSON.parse(response.body as string) as PaypalErrorResponse;

          const { description, issue } = errorDetail;

          const errorMessage = errorDetail
            ? ` ${description} Debug ID: (${(debug_id as string) ?? ''})
            Learn more at ${href}`
            : JSON.stringify(orderData);

          errorToast({ header: issue, message: errorMessage });

          return errorMessage;
        } else {
          throw new Error(orderData);
        }
      }
    } catch (err: unknown) {
      console.log(err);

      errorToast({
        message: err instanceof Error ? err.message : String(err),
      });
      throw new Error('Failed to create PayPal order');
    }
  }, [cart, country_iso2, country_iso3, currency, delivery_address, email, first_name, last_name]);

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

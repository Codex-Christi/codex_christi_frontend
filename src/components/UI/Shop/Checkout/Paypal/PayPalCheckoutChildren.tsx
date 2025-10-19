import errorToast from '@/lib/error-toast';
import MyPaypalButtons from './MyPaypalButtons';
import MyPayPalCardFields from './MyPaypalCardFields';
import successToast from '@/lib/success-toast';
import {
  CompletedTxInterface,
  processCompletedTxAction,
} from '@/actions/shop/paypal/processCompletedTx';
import { FC, useCallback, useContext } from 'react';
import { CheckoutOptions } from '../PaymentSection';
import { encrypt, useCartStore } from '@/stores/shop_stores/cartStore';
import { ServerOrderDetailsContext } from '../ServerOrderDetailsComponent';
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';
import { useShopCheckoutStore } from '@/stores/shop_stores/checkoutStore';
import { useOrderConfirmationStore } from '@/app/shop/checkout/order-confirmation/[id]/store';
import { useShopRouter } from '@/lib/hooks/useShopRouter';
import { createOrderAction } from '@/actions/shop/paypal/createOrderAction';
import { OnApproveData, OrderResponseBody } from '@paypal/paypal-js';
import { OrdersCapture } from '@paypal/paypal-server-sdk';
import { useOrderStringStore } from '@/stores/shop_stores/checkoutStore/ORD-stringStore';

const PayPalCheckoutChildren: FC<{ mode: CheckoutOptions }> = (props) => {
  // Props
  const { mode } = props;

  // Hooks
  const cart = useCartStore((store) => store.variants);
  const serverOrderDetails = useContext(ServerOrderDetailsContext);
  const userId = useUserMainProfileStore((state) => state.userMainProfile?.id);
  const { first_name, last_name, email, delivery_address } = useShopCheckoutStore((state) => state);
  const setPaymentConfirmationData = useOrderConfirmationStore(
    (state) => state.setPaymentConfirmation,
  );
  const ORD_string = useOrderStringStore((s) => s.orderString);
  const router = useShopRouter();

  // Destructuring
  const { countrySupport } = serverOrderDetails || {};
  const { country_iso2, currency, country_iso3 } = countrySupport?.country || {};

  // Create order async function
  const createOrder = useCallback(async (): Promise<string> => {
    try {
      const response = await createOrderAction({
        cart,
        customer: {
          name: `${first_name} ${last_name}`,
          email: email ?? 'john@example.com',
        },
        country: country_iso2 ?? 'US',
        country_iso_3: country_iso3 ?? 'USA',
        initialCurrency: currency ?? 'USD',
        delivery_address,
      });

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

  // Approve Handler (unchanged)
  const onApprove = async (data: OnApproveData): Promise<void> => {
    const authRes = await fetch('/next-api/paypal/orders/authorize', {
      method: 'POST',
      body: JSON.stringify({ orderID: data.orderID }),
    });

    //Object from paypal on authorize
    const authData = JSON.parse(await authRes.json()) as OrderResponseBody;

    const authorizationId = authData?.purchase_units?.[0]?.payments?.authorizations?.[0]?.id;

    if (!authorizationId) {
      errorToast({ message: 'Missing authorization ID' });
      return;
    }

    const capRes = await fetch('/next-api/paypal/orders/capture', {
      method: 'POST',
      body: JSON.stringify({ authorizationId }),
    });

    //Final capturedOrder data
    const capturedOrder = JSON.parse(await capRes.json()) as OrdersCapture;

    if (capturedOrder?.status === 'COMPLETED') {
      // Server action that'll process
      const res = await processCompletedTxAction(
        encrypt(
          JSON.stringify({
            capturedOrder,
            authData,
            cart,
            customer: {
              name: `${first_name} ${last_name}`,
              email: email ?? 'john@example.com',
            },
            delivery_address,
            userId: userId ?? null,
            ORD_string,
            country_iso2: country_iso2 ?? 'US',
          } satisfies CompletedTxInterface),
        ),
      );

      console.log(res);

      //If everything goes well in submitting the processed order's details to the backend
      //   if (res.success === true) {
      //     setPaymentConfirmationData(res);
      //     successToast({
      //       message: `Transaction complete: ${capturedOrder.id},`,
      //       header: 'Payment Successfull!',
      //     });

      //     router.push(`/shop/checkout/order-confirmation/${capturedOrder.id}`);
      //   }
      //   // Else if the uploading fails
      //   else {
      //     errorToast({ header: `Payment details upload failed`, message: res.message });
      //   }

      // If payment capture fails for some reason
    } else {
      errorToast({ message: `Capture failed` });
    }
  };

  // Main JSX
  return (
    <div className='w-full mx-auto'>
      <MyPaypalButtons mode={mode} createOrder={createOrder} onApprove={onApprove} />

      <MyPayPalCardFields mode={mode} createOrder={createOrder} onApprove={onApprove} />
    </div>
  );
};

export default PayPalCheckoutChildren;

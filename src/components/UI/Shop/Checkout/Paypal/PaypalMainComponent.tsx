'use client';

import { FC, useState } from 'react';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { OnApproveData } from '@paypal/paypal-js';
import errorToast from '@/lib/error-toast';
import { CheckoutOptions } from '../ProductCheckout';
import {
  BillingAddressInterface,
  createOrderAction,
} from '@/actions/shop/paypal/createOrderAction';
import { useCartStore } from '@/stores/shop_stores/cartStore';
import successToast from '@/lib/success-toast';
import dynamic from 'next/dynamic';

const MyPayPalCardFields = dynamic(() =>
  import('./MyPaypalCardFields').then((comp) => comp.default)
);
const MyPaypalButtons = dynamic(() =>
  import('./MyPaypalButtons').then((comp) => comp.default)
);

const PayPalCheckout: FC<{ mode: CheckoutOptions }> = (props) => {
  // Hooks
  const { mode } = props;
  const cart = useCartStore((store) => store.variants);

  const initialOptions = {
    clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!,
    'client-id': process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!,
    'enable-funding': 'venmo',
    'buyer-country': 'US',
    currency: 'USD',
    intent: 'authorize',
    components: 'buttons,card-fields',
    'data-sdk-integration-source': 'developer-studio',
  };

  const [billingAddress, setBillingAddress] = useState<BillingAddressInterface>(
    {
      addressLine1: '',
      addressLine2: '',
      adminArea1: '',
      adminArea2: '',
      countryCode: '',
      postalCode: '',
    }
  );

  const handleBillingAddressChange = (
    field: keyof typeof billingAddress,
    value: string
  ) => {
    setBillingAddress((prev) => ({ ...prev, [field]: value }));
  };

  const createOrder = async (acceptBilling: boolean): Promise<string> => {
    try {
      const response = await createOrderAction(
        acceptBilling
          ? {
              acceptBilling: true,
              cart,
              billingAddress,
            }
          : {
              acceptBilling: false,
              cart,
              billingAddress: undefined as never,
            }
      );
      //
      const orderData = await JSON.parse(response);

      if (orderData.id) {
        return orderData.id as string;
      } else {
        const errorDetail = orderData?.result;
        const errorMessage = errorDetail
          ? `${errorDetail.error} ${errorDetail.error_description} (${orderData.debug_id ?? ''})`
          : JSON.stringify(orderData);

        throw new Error(errorMessage);
      }
    } catch (err) {
      console.log(err);

      errorToast({
        message: err instanceof Error ? err.message : String(err),
      });
      // Always throw to ensure a string is never returned as undefined
      throw new Error('Failed to create PayPal order');
    }
  };

  const onApprove = async (data: OnApproveData): Promise<void> => {
    const authRes = await fetch('/next-api/paypal/orders/authorize', {
      method: 'POST',
      body: JSON.stringify({ orderID: data.orderID }),
    });

    // console.log(authRes);

    const authData = JSON.parse(await authRes.json());

    console.log(authData);

    const authorizationId =
      authData?.purchase_units?.[0]?.payments?.authorizations?.[0]?.id;

    if (!authorizationId) {
      errorToast({ message: 'Missing authorization ID' });
      return;
    }

    const capRes = await fetch('/next-api/paypal/orders/capture', {
      method: 'POST',
      body: JSON.stringify({ authorizationId }),
    });

    const captured = JSON.parse(await capRes.json());

    if (captured?.status === 'COMPLETED') {
      console.log(captured);

      successToast({
        message: `Transaction complete: ${captured.id},`,
        header: 'Payment Successfull!',
      });
    } else {
      errorToast({ message: `Capture failed` });
    }
  };

  return (
    <PayPalScriptProvider options={initialOptions}>
      <div className='w-full mx-auto'>
        {/* Paypal Buttons */}

        <MyPaypalButtons
          mode={mode}
          createOrder={createOrder}
          onApprove={onApprove}
        />

        {/* Paypal Card Fields */}
        <MyPayPalCardFields
          mode={mode}
          billingAddress={billingAddress}
          createOrder={createOrder}
          handleBillingAddressChange={handleBillingAddressChange}
          onApprove={onApprove}
        />
      </div>
    </PayPalScriptProvider>
  );
};

export default PayPalCheckout;

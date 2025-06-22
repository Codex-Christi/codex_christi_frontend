/* eslint-disable @typescript-eslint/ban-ts-comment */
'use client';

import React, { FC, useState } from 'react';
import {
  PayPalScriptProvider,
  PayPalButtons,
  PayPalCardFieldsProvider,
  PayPalNameField,
  PayPalNumberField,
  PayPalExpiryField,
  PayPalCVVField,
  usePayPalCardFields,
} from '@paypal/react-paypal-js';
import { OnApproveData } from '@paypal/paypal-js';
import { Input } from '@/components/UI/primitives/input';
import { Button } from '@/components/UI/primitives/button';
import { Loader } from 'lucide-react';
import errorToast from '@/lib/error-toast';
import { CheckoutOptions } from '../ProductCheckout';
import { createOrderAction } from '@/actions/shop/paypal/createOrderAction';
import { useCartStore } from '@/stores/shop_stores/cartStore';
import successToast from '@/lib/success-toast';

const PayPalCheckout: FC<{ mode: CheckoutOptions }> = (props) => {
  // Hooks
  const { mode } = props;
  const cart = useCartStore((store) => store.variants);

  // State Values
  const [isPaying, setIsPaying] = useState(false);

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

  const [billingAddress, setBillingAddress] = useState({
    addressLine1: '',
    addressLine2: '',
    adminArea1: '',
    adminArea2: '',
    countryCode: '',
    postalCode: '',
  });

  const handleBillingAddressChange = (
    field: keyof typeof billingAddress,
    value: string
  ) => {
    setBillingAddress((prev) => ({ ...prev, [field]: value }));
  };

  const createOrder = async () => {
    try {
      const response = await createOrderAction(cart, billingAddress);
      //
      const orderData = await JSON.parse(response);

      if (orderData.id) {
        return orderData.id;
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
        <section
          className={`${mode === 'paypal_buttons' ? 'block' : 'hidden'} w-full !mx-auto`}
        >
          <PayPalButtons
            createOrder={createOrder}
            onApprove={onApprove}
            onError={(err) => {
              console.error(String(err));
              errorToast({ message: String(err) });
            }}
            style={{
              layout: 'horizontal',
              color: 'blue',
              shape: 'pill',
              label: 'pay',
              height: 40,
            }}
          />
        </section>

        {/* Paypal Card Field Providers and Fields */}
        <section
          className={`${mode === 'card' ? 'block' : 'hidden'} w-full !mx-auto`}
        >
          <PayPalCardFieldsProvider
            createOrder={createOrder}
            onApprove={onApprove}
            onError={(err) => {
              console.error('PayPal Card Fields Error:', err);
              errorToast({
                message: 'An error occurred during payment. Please try again.',
              });
            }}
            style={{
              input: {
                color: '#fff',
                'font-size': '14px',
                'font-family': 'Inter',
                // @ts-ignore
                background: 'transparent',
                // @ts-ignore
                border: '1px solid #fff',
                padding: '1rem 2rem',
                // @ts-ignore
                'border-radius': '10px !important',
              },
              // @ts-ignore
              'input:focus': { border: '3px solid #fff' },
              'input:is(:-webkit-autofill, :autofill)': {
                // @ts-ignore
                background: 'transparent !important',
              },
              'input::placeholder': {
                color: '#ccc !important',
              },
              '.invalid': { color: '#DC2626' },
            }}
          >
            {/* Card Field Inputs Start Here */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <PayPalNameField />
              <PayPalNumberField />
              <PayPalExpiryField />
              <PayPalCVVField />

              {/* Other input fields for card details */}
              {(
                [
                  { placeholder: 'Address line 1', strName: 'addressLine1' },
                  { placeholder: 'Address line 2', strName: 'addressLine2' },
                  { placeholder: 'State / Province', strName: 'adminArea1' },
                  { placeholder: 'City / Town', strName: 'adminArea2' },
                  {
                    placeholder: 'Country Code (e.g. US)',
                    strName: 'countryCode',
                  },
                  { placeholder: 'Postal Code', strName: 'postalCode' },
                ] as {
                  placeholder: string;
                  strName: keyof typeof billingAddress;
                }[]
              ).map((each) => {
                const { strName, placeholder } = each;
                return (
                  <Input
                    className='bg-transparent placeholder:text-[#ccc] !py-[1rem] !px-[2rem] text-[14px]
                  h-[unset] rounded-[10px] w-full'
                    key={strName}
                    name={placeholder}
                    placeholder={placeholder}
                    value={billingAddress[strName]}
                    onChange={(e) =>
                      handleBillingAddressChange(strName, e.target.value)
                    }
                  />
                );
              })}
            </div>

            <SubmitPaypalCardPaymentButton
              isPaying={isPaying}
              setIsPaying={setIsPaying}
            />
          </PayPalCardFieldsProvider>
        </section>
      </div>
    </PayPalScriptProvider>
  );
};

// Pay Now button
function SubmitPaypalCardPaymentButton({
  isPaying,
  setIsPaying,
}: {
  isPaying: boolean;
  setIsPaying: (val: boolean) => void;
}) {
  const { cardFieldsForm } = usePayPalCardFields();

  const handleClick = async () => {
    if (!cardFieldsForm)
      return errorToast({ message: 'Payment form unavailable' });

    const formState = await cardFieldsForm.getState();
    if (!formState.isFormValid)
      return errorToast({ message: 'Payment details are invalid' });

    setIsPaying(true);
    try {
      await cardFieldsForm.submit();
    } catch (err) {
      console.error(err);
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <Button
      name='Pay with Card'
      onClick={handleClick}
      disabled={isPaying}
      className='border-[#0085FF] text-white bg-[#0085FF] hover:bg-[#0085FF]/70 hover:text-white 
      !font-bold px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base text-center !my-5 w-full'
    >
      {isPaying ? <Loader className='w-4 h-4 animate-spin' /> : 'Pay with Card'}
    </Button>
  );
}

export default PayPalCheckout;

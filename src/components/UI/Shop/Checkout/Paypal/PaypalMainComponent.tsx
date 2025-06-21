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

const PayPalCheckout: FC<{ mode: CheckoutOptions }> = (props) => {
  // Hooks
  const { mode } = props;

  // State Values
  const [isPaying, setIsPaying] = useState(false);

  const initialOptions = {
    clientId: process.env.NEXT_PAYPAL_CLIENT_ID!,
    'client-id':
      'AVcDvH0fKfAjo2YtUKnmlaWyqoNgxauhAS2dI6ZwIpidqUudBnnS99a-J1h44JuWbFLcAfntTI03Vwaj',
    'enable-funding': 'venmo',
    'disable-funding': '',
    'buyer-country': 'US',
    currency: 'USD',
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
    const response = await fetch('/next-api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cart: [{ sku: '1blwyeo8', quantity: 2 }],
        billingAddress,
      }),
    });
    const orderData = await response.json();
    if (orderData.id) return orderData.id;
    throw new Error(
      orderData?.details?.[0]?.description || 'Order creation failed'
    );
  };

  const onApprove = async (data: OnApproveData) => {
    const res = await fetch(`/api/orders/${data.orderID}/capture`, {
      method: 'POST',
    });
    const orderData = await res.json();
    const transaction =
      orderData?.purchase_units?.[0]?.payments?.captures?.[0] ||
      orderData?.purchase_units?.[0]?.payments?.authorizations?.[0];
    if (!transaction || transaction.status === 'DECLINED') {
      alert('Payment declined or incomplete');
    } else {
      alert(`Transaction ${transaction.status}: ${transaction.id}`);
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

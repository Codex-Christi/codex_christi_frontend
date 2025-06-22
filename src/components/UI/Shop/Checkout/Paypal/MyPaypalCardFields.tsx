/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Input } from '@/components/UI/primitives/input';
import errorToast from '@/lib/error-toast';
import {
  PayPalCardFieldsProvider,
  PayPalCVVField,
  PayPalExpiryField,
  PayPalNameField,
  PayPalNumberField,
  usePayPalCardFields,
} from '@paypal/react-paypal-js';
import { FC, useEffect, useRef, useState } from 'react';
import { CheckoutOptions } from '../ProductCheckout';
import { OnApproveData } from '@paypal/paypal-js';
import loadingToast from '@/lib/loading-toast';
import { toast } from 'sonner';
import { Button } from '@/components/UI/primitives/button';
import { Loader } from 'lucide-react';

{
  /* Paypal Card Field Providers and Fields */
}

export interface MyPayPalCardFieldInterface {
  mode: CheckoutOptions;
  createOrder: (acceptBilling: boolean) => Promise<string>;
  billingAddress: {
    addressLine1: string;
    addressLine2: string;
    adminArea1: string;
    adminArea2: string;
    countryCode: string;
    postalCode: string;
  };
  handleBillingAddressChange: (
    field:
      | 'addressLine1'
      | 'addressLine2'
      | 'adminArea1'
      | 'adminArea2'
      | 'countryCode'
      | 'postalCode',
    value: string
  ) => void;
  onApprove: (data: OnApproveData) => Promise<void>;
}

const MyPayPalCardFields: FC<MyPayPalCardFieldInterface> = (props) => {
  // Props
  const {
    mode,
    createOrder,
    billingAddress,
    handleBillingAddressChange,
    onApprove,
  } = props;

  // State Values
  const [isPaying, setIsPaying] = useState(false);

  // Main JSx
  return (
    <section
      className={`${mode === 'card' ? 'block' : 'hidden'} w-full !mx-auto`}
    >
      <PayPalCardFieldsProvider
        createOrder={() => createOrder(true)}
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

  const loadToastRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (isPaying) {
      loadToastRef.current = loadingToast({ message: 'Payment processing...' });
    } else {
      if (loadToastRef.current) {
        toast.dismiss(loadToastRef.current);
        loadToastRef.current = null;
      }
    }
  }, [isPaying]);

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

export default MyPayPalCardFields;

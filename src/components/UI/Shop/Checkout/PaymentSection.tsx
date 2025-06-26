import Image from 'next/image';
import { Checkbox } from '../../primitives/checkbox';
import { Label } from '../../primitives/label';
import PayPal from '@/assets/img/paypal.png';
import GooglePay from '@/assets/img/gpay.png';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useState } from 'react';

// Dynamic Imports
const PayPalCheckout = dynamic(() =>
  import('./Paypal/PaypalMainComponent').then((comp) => comp.default)
);

export type CheckoutOptions = 'card' | 'paypal_buttons' | 'google_pay' | '';

// Main Compoenent
const PaymentSection = () => {
  const [payOption, setPayOption] = useState<CheckoutOptions>('');

  // JSX
  return (
    <>
      <h2 className='border-b max-w-fit mb-10 border-white pb-1 text-xl font-bold'>
        Payment Method
      </h2>

      <div className='grid gap-8'>
        <div className='space-y-4'>
          <p className='text-lg font-bold'>Pay with:</p>

          <div className='flex items-center gap-8 flex-wrap'>
            {/*  */}
            {/* Checkbox for Debit / Credit Card */}
            <p className='flex items-center gap-2'>
              <Checkbox
                className={`w-[1.15rem] h-[1.15rem] border-white text-white`}
                checked={payOption === 'card'}
                onCheckedChange={() => setPayOption('card')}
                id='paypal_card_checkbox'
              />
              <Label htmlFor='paypal_card_checkbox' className='cursor-pointer'>
                Credit/Debit Card
              </Label>
            </p>
            {/*  */}

            {/* Checkbox for Paypal Buttons */}
            <p className='flex items-center gap-3'>
              <Checkbox
                className={`w-[1.15rem] h-[1.15rem] border-white text-white`}
                checked={payOption === 'paypal_buttons'}
                onCheckedChange={() => setPayOption('paypal_buttons')}
                id='paypal_buttons'
              />

              <Label htmlFor='paypal_buttons' className='cursor-pointer'>
                <Image
                  className='w-10 h-auto'
                  src={PayPal}
                  alt='Pay with Paypal'
                />
              </Label>
            </p>
            {/*  */}

            {/* Checkbox for Google Pay */}
            <p className='flex items-center gap-3'>
              <Checkbox
                className={`w-[1.15rem] h-[1.15rem] border-white text-white`}
                checked={payOption === 'google_pay'}
                onCheckedChange={() => setPayOption('google_pay')}
              />

              <Image
                className='w-10 h-auto'
                src={GooglePay}
                alt='Pay with Google Pay'
              />
            </p>
            {/*  */}
          </div>
        </div>

        <p>
          Create your account Or{' '}
          <span className='font-medium'>
            Already have an account?{' '}
            <Link
              className='underline underline-offset-4 font-semibold'
              href=''
            >
              Sign In
            </Link>
          </span>
        </p>

        {/* Paypal Component Here */}

        <PayPalCheckout mode={payOption} />

        {/*  */}
      </div>
    </>
  );
};

export default PaymentSection;

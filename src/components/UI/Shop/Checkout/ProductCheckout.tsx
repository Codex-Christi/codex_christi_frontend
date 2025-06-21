'use client';

import Image from 'next/image';
import PayPal from '@/assets/img/paypal.png';
import GooglePay from '@/assets/img/gpay.png';
import Link from 'next/link';
import { Checkbox } from '@/components/UI/primitives/checkbox';
import { useState } from 'react';
import { Button } from '@/components/UI/primitives/button';
import dynamic from 'next/dynamic';
import { Label } from '../../primitives/label';

export type CheckoutOptions = 'card' | 'paypal_buttons' | 'google_pay' | '';

// Dynamic Imports
const OrderSummary = dynamic(() =>
  import('./OrderSummary').then((comp) => comp.default)
);
const PayPalCheckout = dynamic(() =>
  import('./Paypal/PaypalMainComponent').then((comp) => comp.default)
);

// Main Component
const CheckoutPage = () => {
  const [payOption, setPayOption] = useState<CheckoutOptions>('');

  return (
    <div className='grid gap-8 items-start px-2 py-12 md:px-[20px] lg:px-[24px] md:grid-cols-2 lg:grid-cols-12'>
      <div className='bg-[#4C3D3D3D] backdrop-blur-[10px] p-4 rounded-[10px] md:p-10 space-y-8 lg:col-span-7'>
        <h2 className='border-b border-white pb-1 text-xl font-bold'>
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
                <Label
                  htmlFor='paypal_card_checkbox'
                  className='cursor-pointer'
                >
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
      </div>

      <OrderSummary />
    </div>
  );
};

export default CheckoutPage;

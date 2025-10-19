import Image from 'next/image';
import { Checkbox } from '../../primitives/checkbox';
import { Label } from '../../primitives/label';
import PayPal from '@/assets/img/paypal.png';
import GooglePay from '@/assets/img/gpay.png';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useContext, useState } from 'react';
import { Button } from '../../primitives/button';
import { FaAngleDoubleUp } from 'react-icons/fa';
import { CheckoutAccordionContext } from './ProductCheckout';

// Dynamic Imports
const PayPalCheckout = dynamic(() =>
  import('./Paypal/PayPalMainCheckoutComponent').then((comp) => comp.default),
);

export type CheckoutOptions = 'card' | 'paypal_buttons' | 'google_pay' | '';

// Main Compoenent
const PaymentSection = () => {
  // Hooks
  // Hooks
  const { handleOpenItem } = useContext(CheckoutAccordionContext);

  // States
  const [payOption, setPayOption] = useState<CheckoutOptions>('');

  // JSX
  return (
    <>
      <section className='flex justify-between w-full items-center mb-10'>
        <h2 className='border-b max-w-fit  border-white text-xl font-bold'>Payment Method</h2>

        <Button
          variant={'outline'}
          className='bg-transparent flex gap-2'
          name='Back to Delivery Information'
          onClick={() => {
            handleOpenItem('basic-checkout-info');
          }}
        >
          <h4>Edit Delivery Info</h4> <FaAngleDoubleUp size={17.5} />
        </Button>
      </section>

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
                <Image className='w-10 h-auto' src={PayPal} alt='Pay with Paypal' />
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

              <Image className='w-10 h-auto' src={GooglePay} alt='Pay with Google Pay' />
            </p>
            {/*  */}
          </div>
        </div>

        <p>
          Create your account Or{' '}
          <span className='font-medium'>
            Already have an account?{' '}
            <Link className='underline underline-offset-4 font-semibold' href=''>
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

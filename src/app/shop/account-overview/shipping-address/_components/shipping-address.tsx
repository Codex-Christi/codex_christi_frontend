'use client';

import Link from 'next/link';
import ShippingAddressModal from './shipping-address-modal';
import {
  ArrowLeftIcon,
  PenLineIcon,
  Trash2Icon,
  PhoneIcon,
  MapPinIcon,
  UserIcon,
} from 'lucide-react';
import { useState } from 'react';

const ShippingAddress = () => {
  const [isActive, setIsActive] = useState(false);

  return (
    <>
      <div className='flex items-center gap-4 justify-between flex-wrap'>
        <div className='inline-block w-auto'>
          <Link
            className='inline-flex items-center gap-4 transition-all ease-linear duration-200 hover:gap-6 w-auto'
            href='/shop/account-overview'
          >
            <ArrowLeftIcon strokeWidth={1.2} />
            Shipping Address
          </Link>
        </div>

        <button
          className='text-sm border border-[#F3F3F3] rounded-xl p-2 hover:bg-[linear-gradient(180deg,_rgba(243,_243,_243,_0.08)_0%,_rgba(141,_141,_141,_0.08)_100%)] transition-color duration-300 ease-linear'
          type='button'
          onClick={() => setIsActive(true)}
        >
          Add New Address +
        </button>
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        {Array.from({ length: 2 }).map((_, index) => (
          <div className='grid gap-4 border border-[#F3F3F3] rounded-[20px] p-4' key={index}>
            <div className='space-y-3'>
              <p className='flex items-center gap-2 text-sm'>
                <UserIcon width={18} /> Mark Alveu
              </p>

              <p className='flex items-center gap-2 text-sm'>
                <MapPinIcon width={18} /> 456 Downtown, Ohio
              </p>

              <p className='flex items-center gap-2 text-sm'>
                <PhoneIcon width={18} /> +179-678-9876
              </p>
            </div>

            <div className='ml-auto flex items-center gap-4'>
              <button
                className='text-sm flex items-center gap-1 text-[#F3F3F3]/50'
                type='button'
                onClick={() => setIsActive(true)}
              >
                <PenLineIcon width={18} />
                Edit
              </button>

              <button className='text-sm flex items-center gap-1 text-[#F3F3F3]/50' type='button'>
                <Trash2Icon width={18} />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <ShippingAddressModal isActive={isActive} setIsActive={setIsActive} />
    </>
  );
};

export default ShippingAddress;

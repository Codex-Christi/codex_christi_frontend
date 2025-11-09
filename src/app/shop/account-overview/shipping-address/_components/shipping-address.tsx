'use client';

import Link from 'next/link';
import ShippingAddressModal from './shipping-address-modal';
import {
  ArrowLeftIcon,
  PenLineIcon,
  Trash2Icon,
//   PhoneIcon,
  MapPinIcon,
  UserIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useUserShopProfile } from '@/stores/shop_stores/use-user-shop-profile';

const ShippingAddress = () => {
  const [isActive, setIsActive] = useState(false);

  const { userShopProfile, isLoading } = useUserShopProfile((state) => state);

  const hasCompleteShippingInfo = (profile: typeof userShopProfile): boolean => {
    if (!profile?.data) return false;

    const { shipping_address, shipping_city, shipping_state, shipping_country } = profile.data;

    return !!(shipping_address && shipping_city && shipping_state && shipping_country);
  };

  if (isLoading) {
    return (
      <div className='animate-pulse bg-[linear-gradient(180deg,_rgba(243,_243,_243,_0.08)_0%,_rgba(141,_141,_141,_0.08)_100%)] border border-[#F3F3F3] rounded-[20px] h-32' />
    );
  }

  if (!hasCompleteShippingInfo(userShopProfile)) {
    return (
      <>
        <div className='text-center py-8 text-white space-y-4'>
          <p className='text-lg'>No shipping address found.</p>

          <p>
            <button
              className='text-sm border border-[#F3F3F3] rounded-xl p-2 hover:bg-[linear-gradient(180deg,_rgba(243,_243,_243,_0.08)_0%,_rgba(141,_141,_141,_0.08)_100%)] transition-color duration-300 ease-linear'
              type='button'
              onClick={() => setIsActive(true)}
            >
              Add New Address +
            </button>
          </p>
        </div>
        <ShippingAddressModal isActive={isActive} setIsActive={setIsActive} />
      </>
    );
  }

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

        {/* <button
          className='text-sm border border-[#F3F3F3] rounded-xl p-2 hover:bg-[linear-gradient(180deg,_rgba(243,_243,_243,_0.08)_0%,_rgba(141,_141,_141,_0.08)_100%)] transition-color duration-300 ease-linear'
          type='button'
          onClick={() => setIsActive(true)}
        >
          Add New Address +
        </button> */}
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        {hasCompleteShippingInfo(userShopProfile) && (
          <div className='grid gap-4 border border-[#F3F3F3] rounded-[20px] p-4'>
            <div className='space-y-3'>
              <p className='flex items-center gap-2 text-sm'>
                <UserIcon width={18} />
                {userShopProfile?.data?.first_name} {userShopProfile?.data?.last_name}
              </p>

              <p className='flex items-start gap-2 text-sm'>
                <MapPinIcon className='shrink-0' width={18} />
                {userShopProfile?.data?.shipping_address}, {userShopProfile?.data?.shipping_city},{' '}
                {userShopProfile?.data?.shipping_state}, {userShopProfile?.data?.shipping_country}
              </p>

              {/* <p className='flex items-center gap-2 text-sm'>
                <PhoneIcon width={18} /> +179-678-9876
              </p> */}
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
        )}
      </div>

      <ShippingAddressModal isActive={isActive} setIsActive={setIsActive} />
    </>
  );
};

export default ShippingAddress;

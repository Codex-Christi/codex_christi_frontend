'use client';

import {
  ArrowLeftIcon,
  HeartIcon,
  MapPinIcon,
  TimerResetIcon,
  FilesIcon,
  LogOut,
} from 'lucide-react';
import { useUserShopProfile } from '@/stores/shop_stores/use-user-shop-profile';
import { useUserMainProfileStore } from '@/stores/userMainProfileStore';
import CustomShopLink from '@/components/UI/Shop/HelperComponents/CustomShopLink';
import { logoutUser } from '@/actions/logout';
import { useState } from 'react';
import AccountLoadError from '@/components/UI/Auth/AccountLoadError';

const AccountOverviewTabs = () => {
  const [loggingOut, setLoggingOut] = useState(false);
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutUser();
    } finally {
      setLoggingOut(false);
    }
  };
  const { userShopProfile, isLoading, error, setProfileFromServer } = useUserShopProfile(
    (state) => state,
  );

  const userMainProfile = useUserMainProfileStore((state) => state.userMainProfile);

  if (isLoading) {
    return (
      <div className='animate-pulse bg-[linear-gradient(180deg,_rgba(243,_243,_243,_0.08)_0%,_rgba(141,_141,_141,_0.08)_100%)] border border-[#F3F3F3]/50 rounded-[20px] h-32' />
    );
  }

  return (
    <>
      <AccountLoadError message={error} retry={setProfileFromServer} />
      <div className='inline-block w-auto'>
        <CustomShopLink
          className='inline-flex items-center gap-4 transition-all ease-linear duration-200 hover:gap-6 w-auto'
          href='/shop'
        >
          <ArrowLeftIcon strokeWidth={1.2} />
          Account Overview
        </CustomShopLink>
      </div>

      <div className='rounded-lg grid grid-cols-2 md:grid-cols-3'>
        <div className='text-center border border-b-0 border-[#F3F3F3] py-4 px-2 grid gap-4 rounded-tl-lg place-content-center hover:bg-[linear-gradient(180deg,_rgba(243,_243,_243,_0.08)_0%,_rgba(141,_141,_141,_0.08)_100%)] transition-color duration-300 ease-linear'>
          <h3 className='font-semibold text-sm'>Account Information</h3>

          <div className='text-xs break-words [word-break:break-word] [word-wrap:break-word] space-y-1'>
            <p className='font-semibold'>
              {userShopProfile?.data?.first_name} {userShopProfile?.data?.last_name}
            </p>

            <p>{userMainProfile?.email}</p>
          </div>
        </div>

        <CustomShopLink
          className='text-center border border-l-0 border-[#F3F3F3] py-4 px-2 grid gap-4 rounded-tr-lg md:rounded-tr-none md:border-r-0 place-content-center hover:bg-[linear-gradient(180deg,_rgba(243,_243,_243,_0.08)_0%,_rgba(141,_141,_141,_0.08)_100%)] transition-color duration-300 ease-linear'
          href='/shop/my-wishlist'
        >
          <h3 className='font-semibold text-sm'>Wishlist</h3>

          <div className='mx-auto'>
            <HeartIcon strokeWidth={1.2} />
          </div>

          <p className='text-center text-sm'>See your favorites</p>
        </CustomShopLink>

        <CustomShopLink
          className='text-center border border-[#F3F3F3] py-4 px-2 grid gap-4 md:rounded-tr-lg place-content-center hover:bg-[linear-gradient(180deg,_rgba(243,_243,_243,_0.08)_0%,_rgba(141,_141,_141,_0.08)_100%)] transition-color duration-300 ease-linear'
          href='/shop/account-overview/shipping-address'
        >
          <h3 className='font-semibold text-sm'>Shipping Address</h3>

          <div className='mx-auto'>
            <MapPinIcon strokeWidth={1.2} />
          </div>

          <p className='text-center text-sm'>Set default address +</p>
        </CustomShopLink>

        <CustomShopLink
          className='text-center border max-md:border-l-0 max-md:border-t-0 border-[#F3F3F3] py-4 px-2 grid gap-4 place-content-center md:rounded-bl-lg hover:bg-[linear-gradient(180deg,_rgba(243,_243,_243,_0.08)_0%,_rgba(141,_141,_141,_0.08)_100%)] transition-color duration-300 ease-linear'
          href='/shop/account-overview/order-history'
        >
          <h3 className='font-semibold text-sm'>Order History</h3>

          <div className='mx-auto'>
            <TimerResetIcon strokeWidth={1.2} />
          </div>
        </CustomShopLink>

        <CustomShopLink
          className='text-center border max-md:border-t-0 border-[#F3F3F3] py-4 px-2 grid gap-4 max-md:rounded-bl-lg place-content-center md:border-l-0 hover:bg-[linear-gradient(180deg,_rgba(243,_243,_243,_0.08)_0%,_rgba(141,_141,_141,_0.08)_100%)] transition-color duration-300 ease-linear'
          href='/shop/account-overview/payment-info'
        >
          <h3 className='font-semibold text-sm'>Payment Information</h3>

          <div className='mx-auto'>
            <FilesIcon strokeWidth={1.2} />
          </div>
        </CustomShopLink>

        <button
          className='text-center border border-l-0 max-md:border-t-0 border-[#F3F3F3] py-4 px-2 grid gap-4 rounded-br-lg place-content-center hover:bg-[linear-gradient(180deg,_rgba(243,_243,_243,_0.08)_0%,_rgba(141,_141,_141,_0.08)_100%)] transition-color duration-300 ease-linear disabled:opacity-50'
          type='button'
          onClick={() => {
            void handleLogout();
          }}
          disabled={loggingOut}
          aria-busy={loggingOut}
        >
          <span className='font-semibold text-sm'>{loggingOut ? 'Logging out...' : 'Logout'}</span>

          <div className='mx-auto'>
            <LogOut strokeWidth={1.2} aria-hidden='true' />
          </div>
        </button>
      </div>
    </>
  );
};

export default AccountOverviewTabs;

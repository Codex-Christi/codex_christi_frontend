'use client';

import Link from 'next/link';
import OngoingOrders from './ongoing-orders';
import ReturnedOrders from './returned-orders';
import DeliveredOrders from './delivered-orders';
import { ArrowLeftIcon, Clock4Icon } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const Orders = () => {
  const [currentTab, setCurrentTab] = useState('Ongoing');

  return (
    <>
      <div className='inline-block w-auto'>
        <Link
          className='inline-flex items-center gap-4 transition-all ease-linear duration-200 hover:gap-6 w-auto'
          href='/shop/account-overview'
        >
          <ArrowLeftIcon strokeWidth={1.2} />

          <span className='flex items-center gap-2'>
            Order History <Clock4Icon className='fill-white stroke-black' />
          </span>
        </Link>
      </div>

      <div className='grid gap-8'>
        <div className='flex items-center justify-between gap-x-2 gap-y-4 flex-wrap'>
          <button
            className={cn('border-b-2 text-left border-transparent', {
              'border-white': currentTab === 'Ongoing',
            })}
            onClick={() => setCurrentTab('Ongoing')}
            type='button'
          >
            ONGOING (0)
          </button>

          <button
            className={cn('border-b-2 text-left border-transparent', {
              'border-white': currentTab === 'Delivered',
            })}
            onClick={() => setCurrentTab('Delivered')}
            type='button'
          >
            DELIVERED (0)
          </button>

          <button
            className={cn('border-b-2 text-left border-transparent', {
              'border-white': currentTab === 'Returned',
            })}
            onClick={() => setCurrentTab('Returned')}
            type='button'
          >
            RETURNED/CANCELLED (0)
          </button>
        </div>

        <OngoingOrders className={currentTab === "Ongoing" ? 'block' : 'hidden'} />

        <DeliveredOrders className={currentTab === "Delivered" ? 'block' : 'hidden'} />

        <ReturnedOrders className={currentTab === "Returned" ? 'block' : 'hidden'} />
      </div>
    </>
  );
};

export default Orders;

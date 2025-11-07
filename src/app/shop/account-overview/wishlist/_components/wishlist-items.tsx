'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeftIcon, HeartIcon, StarIcon } from 'lucide-react';
import { formatAmount } from '@/lib/utils/format-amount';

const WishlistItems = () => {
  return (
    <>
      <div className='inline-block w-auto'>
        <Link
          className='inline-flex items-center gap-4 transition-all ease-linear duration-200 hover:gap-6 w-auto'
          href='/shop/account-overview'
        >
          <ArrowLeftIcon strokeWidth={1.2} />
          <span className='flex items-center gap-2'>
            Wishlist (2) <HeartIcon className='fill-white' />
          </span>
        </Link>
      </div>

      <div className='grid gap-x-6 gap-y-8 md:grid-cols-2'>
        <div className='grid gap-4'>
          <div className='flex items-start gap-2'>
            <div className='relative w-2/5 h-16'>
              <Image src='/wishlist-blue.png' alt='Blue jacket' quality={100} fill />
            </div>

            <div className='text-sm space-y-1.5'>
              <p>White hoodie, long sleeve with front pocket</p>

              <p className='flex items-center gap-4'>
                <span>{formatAmount({ amount: 4500 })}</span>

                <span className='text-xs'>
                  <del>{formatAmount({ amount: 5000 })}</del>
                </span>
              </p>

              <p className='flex items-center gap-1.5 leading-none'>
                {Array.from({ length: 5 }).map((_, index) => (
                  <StarIcon className='fill-white' width={10} key={index} />
                ))}
              </p>
            </div>
          </div>

          <div className='ml-auto flex items-center gap-4'>
            <button
              className='text-sm bg-white text-black border border-[#F3F3F3] font-bold rounded-xl py-2 px-3'
              type='button'
            >
              Add to Cart +
            </button>

            <button
              className='text-sm border border-[#F3F3F3] hover:bg-red-500 hover:border-red-500 hover:text-white font-bold rounded-xl py-2 px-3'
              type='button'
            >
              Remove
            </button>
          </div>
        </div>

        <div className='grid gap-4'>
          <div className='flex items-start gap-2'>
            <div className='relative w-2/5 h-16'>
              <Image src='/wishlist-orange.png' alt='Orange jacket' quality={100} fill />
            </div>

            <div className='text-sm space-y-1.5'>
              <p>White hoodie, long sleeve with front pocket</p>

              <p className='flex items-center gap-4'>
                <span>{formatAmount({ amount: 4500 })}</span>

                <span className='text-xs'>
                  <del>{formatAmount({ amount: 5000 })}</del>
                </span>
              </p>

              <p className='flex items-center gap-1.5 leading-none'>
                {Array.from({ length: 4 }).map((_, index) => (
                  <StarIcon className='fill-white' width={10} key={index} />
                ))}

                <StarIcon className='fill-[#F3F3F399]' width={10} />
              </p>
            </div>
          </div>

          <div className='ml-auto flex items-center gap-4'>
            <button
              className='text-sm bg-white text-black border border-[#F3F3F3] font-bold rounded-xl py-2 px-3'
              type='button'
            >
              Add to Cart +
            </button>

            <button
              className='text-sm border border-[#F3F3F3] hover:bg-red-500 hover:border-red-500 hover:text-white font-bold rounded-xl py-2 px-3'
              type='button'
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default WishlistItems;

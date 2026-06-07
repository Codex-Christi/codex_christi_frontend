'use client';

import dynamic from 'next/dynamic';

const WaitlistButton = dynamic(() => import('./WaitlistButton'), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden='true'
      className='mt-[150px] md:mt-[144px] lg:mt-[136px] mx-auto h-[52px] w-[160px]'
    />
  ),
});

export default function WaitlistButtonSlot() {
  return <WaitlistButton />;
}

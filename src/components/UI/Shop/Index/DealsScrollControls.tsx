'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

function nudgeLaunchMerchScroll(targetId: string, direction: 'left' | 'right') {
  const element = document.getElementById(targetId);
  if (!element) return;

  const step = Math.min(Math.max(element.clientWidth * 0.4, 80), 260);
  element.scrollBy({
    left: direction === 'right' ? step : -step,
    behavior: 'smooth',
  });
}

export default function DealsScrollControls({ targetId }: { targetId: string }) {
  return (
    <>
      <button
        type='button'
        aria-label='Scroll left'
        className='absolute top-[40%] left-0 md:hidden !text-black bg-gray-50 hover:scale-125 hover:shadow-lg hover:shadow-gray-100 rounded-full py-4 px-1'
        onClick={() => nudgeLaunchMerchScroll(targetId, 'left')}
      >
        <ChevronLeft aria-hidden='true' className='size-8' />
      </button>

      <button
        type='button'
        aria-label='Scroll right'
        className='absolute top-[40%] right-0 md:hidden !text-black bg-gray-50 hover:scale-125 hover:shadow-lg hover:shadow-gray-100 rounded-full py-4 px-1'
        onClick={() => nudgeLaunchMerchScroll(targetId, 'right')}
      >
        <ChevronRight aria-hidden='true' className='size-8' />
      </button>
    </>
  );
}

'use client';

import { RotateCcw } from 'lucide-react';
import CustomShopLink from '@/components/UI/Shop/HelperComponents/CustomShopLink';

export default function CategoryError({ retry }: { retry: () => void }) {
  return (
    <main className='mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-6 px-6 py-12 text-center'>
      <h1 className='font-ocr text-2xl'>Products temporarily unavailable</h1>
      <p>We could not load this collection. Please try again in a moment.</p>
      <button
        type='button'
        onClick={retry}
        className='inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-5 py-3 backdrop-blur-xl hover:bg-white/10'
      >
        <RotateCcw size={18} aria-hidden='true' />
        Try again
      </button>
      <CustomShopLink href='/shop/categories' className='underline underline-offset-4'>
        Browse other categories
      </CustomShopLink>
    </main>
  );
}

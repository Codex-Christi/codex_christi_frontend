'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/UI/primitives/button';

export default function RefreshProductsButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      name='Refresh Products Button'
      type='button'
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      aria-busy={isPending}
      className='px-4 py-2 bg-[#0066CC] text-white mx-auto rounded hover:bg-blue-700 disabled:opacity-50'
    >
      {isPending ? 'Refreshing...' : 'Refresh Products'}
    </Button>
  );
}

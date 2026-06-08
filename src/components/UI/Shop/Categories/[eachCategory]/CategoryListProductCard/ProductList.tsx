'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CategoryProductDetail } from '@/app/shop/category/[id]/categoryDetailsSSR';
import ProductCard from './ProductCard';
import Skeleton from './Skeleton';
import { Button } from '@/components/UI/primitives/button';

export default function ProductList({
  count,
  initialData,
}: {
  count: number;
  initialData: CategoryProductDetail[];
}) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  return (
    <>
      <div className='mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 min-[900px]:grid-cols-3 xl:!grid-cols-4 gap-6'>
        {isPending && !data.length ? (
          <Skeleton count={count} />
        ) : (
          data.map((product, index) => (
            <ProductCard key={product._id} product={product} priority={index < 4} />
          ))
        )}
      </div>

      <Button
        name='Refresh Products Button'
        onClick={() => startTransition(() => router.refresh())}
        disabled={isPending}
        className='px-4 py-2 bg-[#0085FF] text-white mx-auto rounded hover:bg-blue-600 disabled:opacity-50'
      >
        {isPending ? 'Refreshing...' : 'Refresh Products'}
      </Button>
    </>
  );
}

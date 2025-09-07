'use client';

import { useState, useEffect, useCallback, startTransition } from 'react';
import { fetchCategoryProducts, type CategoryProductDetail } from './categoryDetailsSSR';
import ProductCard from './ProductCard';
import Skeleton from './Skeleton';
import errorToast from '@/lib/error-toast';
import { Button } from '@/components/UI/primitives/button';

export default function ProductList({
  category,
  initialPage,
  count,
  initialData,
}: {
  category: string;
  initialPage: number;
  count: number;
  initialData: CategoryProductDetail[];
}) {
  const [page, setPage] = useState(initialPage);
  const [data, setData] = useState(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorObj, setErrorObj] = useState<Error | null>(null);

  const fetchProducts = useCallback(
    async (targetPage = page) => {
      setIsLoading(true);
      setIsError(false);
      setErrorObj(null);

      try {
        const newData = await fetchCategoryProducts({
          category,
          page: targetPage,
          page_size: count,
        });
        setData(newData.products);
        setPage(targetPage);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        setIsError(true);
        setErrorObj(err);
        errorToast({ message: `An error occurred: ${err.message}` });
      } finally {
        setIsLoading(false);
      }
    },
    [category, count, page],
  );

  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const newPage = parseInt(params.get('page') || '1', 10);
      if (newPage !== page) {
        setPage(newPage);
        startTransition(() => fetchProducts(newPage));
      }
    };

    handleUrlChange();

    window.addEventListener('urlchange', handleUrlChange);

    return () => {
      window.removeEventListener('urlchange', handleUrlChange);
    };
  }, [page, fetchProducts]);

  const refreshProducts = useCallback(() => fetchProducts(page), [fetchProducts, page]);

  return (
    <>
      <div className='mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 min-[900px]:grid-cols-3 xl:!grid-cols-4 gap-6'>
        {isLoading && !data.length ? (
          <Skeleton count={count} />
        ) : (
          data.map((product) => <ProductCard key={product._id} product={product} />)
        )}
      </div>

      {isError && (
        <div className='flex flex-col items-center justify-center mt-8'>
          <div className='animate-pulse text-red-500 text-center mb-4'>
            <p className='text-lg font-semibold'>Oops! Something went wrong.</p>
            <p className='text-sm'>{errorObj?.message || 'Unknown error occurred.'}</p>
          </div>
          <Button
            name='Retry Button'
            onClick={refreshProducts}
            disabled={isLoading}
            className='px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50'
          >
            {isLoading ? 'Retrying...' : 'Retry'}
          </Button>
        </div>
      )}

      {!isError && (
        <Button
          name='Refresh Products Button'
          onClick={refreshProducts}
          disabled={isLoading}
          className='px-4 py-2 bg-[#0085FF] text-white mx-auto rounded hover:bg-blue-600 disabled:opacity-50'
        >
          {isLoading ? 'Refreshing...' : 'Refresh Products'}
        </Button>
      )}
    </>
  );
}

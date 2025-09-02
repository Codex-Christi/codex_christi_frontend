// app/category/[id]/ProductList.tsx
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
  const [errorObj, setErrorObj] = useState<unknown | Error>(null);

  // Unified fetch handler
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
        setIsError(true);
        setErrorObj(error);
        errorToast({
          message: `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [category, count, page],
  );

  // Listen for URL changes (for pagination)
  useEffect(() => {
    const handleUrlChange = () => {
      const params = new URLSearchParams(window.location.search);
      const newPage = parseInt(params.get('page') || '1');

      if (newPage !== page) {
        startTransition(() => {
          fetchProducts(newPage);
        });
      }
    };

    // Add event listener for custom URL change events
    window.addEventListener('urlchange', handleUrlChange);

    // Also check URL on initial load
    const params = new URLSearchParams(window.location.search);
    const urlPage = parseInt(params.get('page') || '1');
    if (urlPage !== page) {
      startTransition(() => {
        fetchProducts(urlPage);
      });
    }

    return () => {
      window.removeEventListener('urlchange', handleUrlChange);
    };
  }, [page, fetchProducts]);

  // Refresh function
  const refreshProducts = useCallback(async () => {
    await fetchProducts(page);
  }, [fetchProducts, page]);

  return (
    <>
      <div className='mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 min-[900px]:grid-cols-3  xl:!grid-cols-4 gap-6'>
        {isLoading ? (
          <Skeleton count={count} />
        ) : (
          <>
            {data.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </>
        )}
      </div>

      {/* Refresh Button */}
      <Button
        name='Refresh Products Button'
        onClick={refreshProducts}
        disabled={isLoading}
        className='px-4 py-2 bg-blue-500 text-white mx-auto rounded hover:bg-blue-600 disabled:opacity-50'
      >
        {isLoading ? 'Refreshing...' : 'Refresh Products'}
      </Button>
    </>
  );
}

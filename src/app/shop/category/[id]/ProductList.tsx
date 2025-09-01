// app/category/[id]/ProductList.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchCategoryProducts,
  type CategoryProductsResponse,
  type CategoryProductDetail,
} from './categoryDetailsSSR';
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
  const [page, ,] = useState(initialPage);
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
      } catch (error) {
        setIsError(true);
        setErrorObj(error);
      } finally {
        setIsLoading(false);
      }
    },
    [category, count, page],
  );

  // Re-fetch when page changes
  useEffect(() => {
    if (page !== initialPage) {
      fetchProducts(page);
    }
  }, [page, category, count, initialPage, fetchProducts]);

  // Error-Catching toast
  useEffect(() => {
    if (isError && errorObj) {
      errorToast({
        message: `An error occurred: ${
          errorObj instanceof Error ? errorObj.message : 'Unknown error'
        }`,
      });
    }
  }, [isError, errorObj]);

  // Refresh function
  const refreshProducts = () => fetchProducts(page);

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

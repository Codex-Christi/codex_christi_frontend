'use client';

import { cn } from '@/lib/utils';
import { useCallback, useEffect, useState } from 'react';
import { formatAmount } from '@/lib/utils/format-amount';

interface MultiplierData {
  multiplier: number;
  currency: string;
  currency_symbol: string;
  isLoading: boolean;
}

export default function PriceDisplay({ className }: { className?: string }) {
  const [data, setData] = useState<MultiplierData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (code: string) => {
    setLoading(true);

    try {
      const res = await fetch(`/next-api/currency/multiplier?code=${code}`, {
        next: { revalidate: 86400 },
      });

      const json = await res.json();

      setData(json);
    } catch (err) {
      const fetchError = err as Error;

      setError(fetchError?.message || 'There was an error fetching price.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    function handleChange() {
      const code = localStorage.getItem('codex-selected-currency') || 'USA';

      fetchData(code);
    }

    handleChange();
    window.addEventListener('currency-change', handleChange);
    return () => window.removeEventListener('currency-change', handleChange);
  }, [fetchData]);

  if (loading || !data)
    return <div className='w-4/5 animate-pulse bg-white rounded-full h-4 mx-auto' />;

  if (!data && !error) return <p className='text-red-400'>Could not load currency multiplier.</p>;

  if (error) return <p className='text-red-400'>{error}</p>;

  return (
    <p className={cn('text-center font-bold text-white text-lg', className)}>
      {data?.currency_symbol} {formatAmount({ amount: data?.multiplier || 0, showCurrency: false })}
    </p>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, RotateCcw, Search } from 'lucide-react';
import { CountryDropdown } from '@/components/UI/primitives/country-dropdown';
import {
  adminFieldClass,
  adminGlassPanelClass,
} from '@/components/UI/Admin/dashboard/AdminGlassPanel';
import {
  PRODUCT_DIRECTORY_ROUTE,
  productDirectoryHref,
  type readProductDirectoryFilters,
} from './filters';

export default function ProductDirectoryFilters({
  filters,
}: {
  filters: ReturnType<typeof readProductDirectoryFilters>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(filters.query);
  const [country, setCountry] = useState(filters.country);
  const [attention, setAttention] = useState(filters.attentionOnly);
  const [pending, startTransition] = useTransition();
  function apply(country: string, attentionOnly = attention) {
    const href = productDirectoryHref({ ...filters, country, query, attentionOnly });
    startTransition(() => {
      if (href === productDirectoryHref(filters, filters.page)) router.refresh();
      else router.replace(href, { scroll: false });
    });
  }
  return (
    <form
      action={PRODUCT_DIRECTORY_ROUTE}
      method='get'
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        apply(country);
      }}
      className={`${adminGlassPanelClass} flex flex-wrap items-end gap-3 p-4`}
    >
      <label htmlFor='product-directory-query' className='grid min-w-0 flex-1 gap-2 text-sm'>
        <span>Product name or ID</span>
        <input
          id='product-directory-query'
          className={adminFieldClass}
          name='q'
          disabled={pending}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={100}
          placeholder='Find a product'
        />
      </label>
      <fieldset className='min-w-0 w-full text-sm sm:w-72'>
        <legend className='mb-2'>Delivery country</legend>
        <input type='hidden' name='country' value={country} />
        <CountryDropdown
          key={country}
          defaultValue={country}
          disabled={pending}
          onChange={(selection) => {
            setCountry(selection.alpha3);
            apply(selection.alpha3);
          }}
          unstyled
          classNames={{
            trigger: `${adminFieldClass} inline-flex w-full items-center justify-between gap-2`,
            popover:
              'w-[min(22rem,calc(100vw-2rem))] border-white/10 bg-[#0D0D0DFA] p-0 backdrop-blur-xl',
            command: 'bg-[#0D0D0DFA] text-white',
            commandInput: 'bg-transparent placeholder:text-white/60',
            commandItem: 'text-white',
            name: 'truncate',
          }}
        />
      </fieldset>
      <label className='flex min-h-10 items-center gap-2 text-sm'>
        <input
          type='checkbox'
          name='attention'
          value='1'
          checked={attention}
          disabled={pending}
          onChange={(event) => {
            setAttention(event.target.checked);
            apply(country, event.target.checked);
          }}
        />
        Needs review only
      </label>
      <button
        disabled={pending}
        className='inline-flex min-h-10 items-center gap-2 rounded-md bg-white px-3 py-2 text-sm text-black hover:bg-white/90 disabled:opacity-50'
      >
        {pending ? <LoaderCircle size={15} className='animate-spin' /> : <Search size={15} />}
        Search
      </button>
      <button
        type='button'
        disabled={pending}
        className='inline-flex min-h-10 items-center gap-2 px-2 text-sm text-slate-300 hover:text-white'
        onClick={() => {
          setQuery('');
          setAttention(false);
          startTransition(() => router.push(PRODUCT_DIRECTORY_ROUTE));
        }}
      >
        <RotateCcw size={15} />
        Reset
      </button>
      {pending && (
        <span role='status' className='w-full text-sm text-slate-300'>
          Loading delivery results...
        </span>
      )}
    </form>
  );
}

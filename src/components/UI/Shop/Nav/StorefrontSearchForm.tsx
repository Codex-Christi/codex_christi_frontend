'use client';

import { useId, useState } from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import { Search, RotateCw } from 'lucide-react';
import { useShopRouter } from '@/lib/hooks/useShopRouter';
import type { ProductSearchIndex } from '@/lib/merchizeStorefront/productSearch';
import styles from './StorefrontSearch.module.css';

async function loadSuggestions(url: string) {
  const [response, { createProductSearch }] = await Promise.all([
    fetch(url),
    import('@/lib/merchizeStorefront/productSearch'),
  ]);
  if (!response.ok) throw new Error('Suggestions unavailable');
  const index: ProductSearchIndex = await response.json();
  return { search: createProductSearch(index.products), truncated: index.truncated };
}

export default function StorefrontSearchForm({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [active, setActive] = useState(-1);
  const id = useId();
  const router = useShopRouter();
  const { data, error, isLoading, mutate } = useSWR(
    engaged ? '/next-api/shop/search-index' : null,
    loadSuggestions,
    {
      dedupingInterval: 60_000,
      focusThrottleInterval: 60_000,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    },
  );
  const suggestions = data?.search(query) ?? [];
  const expanded = open && query.trim().length > 0;

  function navigate(productId?: string) {
    setOpen(false);
    setActive(-1);
    router.push(
      productId
        ? `/shop/product/${encodeURIComponent(productId)}`
        : `/shop/search?${new URLSearchParams({ q: query.trim() })}`,
    );
  }

  return (
    <form
      role='search'
      action='/shop/search'
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (query.trim()) navigate();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <input
        name='q'
        type='search'
        value={query}
        maxLength={100}
        required
        role='combobox'
        aria-label='Search products'
        aria-autocomplete='list'
        aria-expanded={expanded}
        aria-controls={`${id}-suggestions`}
        aria-activedescendant={expanded && suggestions[active] ? `${id}-${active}` : undefined}
        autoComplete='off'
        placeholder='Search products...'
        onFocus={() => {
          setEngaged(true);
          setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Enter' && expanded && suggestions[active]) {
            event.preventDefault();
            navigate(suggestions[active].id);
          }
          if (event.key === 'Escape') {
            setOpen(false);
            setActive(-1);
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            if (suggestions.length)
              setActive((index) =>
                index < 0
                  ? event.key === 'ArrowDown'
                    ? 0
                    : suggestions.length - 1
                  : (index + (event.key === 'ArrowDown' ? 1 : suggestions.length - 1)) %
                    suggestions.length,
              );
          }
        }}
      />
      <button
        type='submit'
        title='Search products'
        aria-label='Search products'
        className={styles.submit}
      >
        <Search size={20} />
      </button>
      {expanded && (
        <div className={styles.suggestions}>
          <ul id={`${id}-suggestions`} role='listbox' aria-label='Product suggestions'>
            {suggestions.map((product, index) => (
              <li
                key={product.id}
                id={`${id}-${index}`}
                role='option'
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => navigate(product.id)}
              >
                <span className={styles.thumbnail}>
                  {product.image && (
                    <Image src={product.image} alt='' width={40} height={48} sizes='40px' />
                  )}
                </span>
                <span>{product.title}</span>
              </li>
            ))}
          </ul>
          <div className={styles.status} role='status'>
            {isLoading ? (
              'Loading suggestions...'
            ) : error ? (
              <>
                Suggestions unavailable.{' '}
                <button
                  type='button'
                  onClick={() => void mutate()}
                  title='Retry suggestions'
                  aria-label='Retry suggestions'
                >
                  <RotateCw size={16} />
                </button>
              </>
            ) : !suggestions.length ? (
              'No suggestions.'
            ) : data?.truncated ? (
              'More products may appear in search results.'
            ) : null}
          </div>
          <button
            type='button'
            className={styles.allResults}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => navigate()}
          >
            <Search size={16} /> Search for &ldquo;{query.trim()}&rdquo;
          </button>
        </div>
      )}
    </form>
  );
}

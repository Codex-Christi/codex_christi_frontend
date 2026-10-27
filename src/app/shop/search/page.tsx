import type { Metadata } from 'next';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, ImageOff } from 'lucide-react';
import StorefrontSearchForm from '@/components/UI/Shop/Nav/StorefrontSearchForm';
import CustomShopLink from '@/components/UI/Shop/HelperComponents/CustomShopLink';
import GlobalProductPrice from '@/components/UI/Shop/GlobalShopComponents/GlobalProductPrice';
import { normalizeSearchQuery } from '@/lib/merchizeStorefront/productSearch';
import { searchStorefrontProducts } from '@/lib/merchizeStorefront/searchCatalog';
import styles from './search.module.css';

export const metadata: Metadata = {
  title: 'Search Products | Codex Christi Shop',
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = normalizeSearchQuery(typeof params.q === 'string' ? params.q : '');
  const requestedPage = Number(params.page ?? 1);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 1000
      ? requestedPage
      : 1;
  const results = query ? await searchStorefrontProducts(query, page) : null;
  const pageLink = (page: number) =>
    `/shop/search?${new URLSearchParams({ q: query, page: String(page) })}`;

  return (
    <main className={styles.page}>
      <h1>Search Products</h1>
      <div className={styles.search}>
        <StorefrontSearchForm key={query} initialQuery={query} />
      </div>
      {results && (
        <section aria-label='Search results'>
          <h2>
            {results.source === 'similar' && results.products.length
              ? 'Similar products'
              : 'Results'}{' '}
            for &ldquo;{query}&rdquo;
          </h2>
          {results.source === 'saved' && (
            <p role='status'>
              Live search is temporarily unavailable. Showing matching saved products; details may
              have changed.
            </p>
          )}
          {results.source === 'unavailable' ? (
            <div className={styles.empty}>
              <p role='alert'>Search is temporarily unavailable. Please try again.</p>
              <CustomShopLink href='/shop/categories'>Browse categories</CustomShopLink>
            </div>
          ) : results.products.length ? (
            <div className={styles.grid}>
              {results.products.map((product, index) => (
                <CustomShopLink
                  key={product.id}
                  href={`/shop/product/${encodeURIComponent(product.id)}`}
                  prefetch={false}
                  className={styles.product}
                >
                  <div className={styles.image}>
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt={product.title}
                        fill
                        preload={index === 0}
                        sizes='(max-width: 639px) calc((100vw - 48px) / 2), (max-width: 1023px) 30vw, 260px'
                      />
                    ) : (
                      <ImageOff aria-label='No product photo' />
                    )}
                  </div>
                  <h3>{product.title}</h3>
                  {product.price !== null && Number.isFinite(product.price) && (
                    <GlobalProductPrice usdAmount={product.price} />
                  )}
                </CustomShopLink>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>
              No matching products{page > 1 ? ' on this page' : ''}. Try another product name.
            </p>
          )}
          {results.totalPages > 1 && (
            <nav aria-label='Search pagination' className={styles.pagination}>
              {page > 1 && (
                <CustomShopLink
                  href={pageLink(page - 1)}
                  ariaLabel='Previous search page'
                  prefetch={false}
                >
                  <ArrowLeft size={18} /> Previous
                </CustomShopLink>
              )}
              <span>
                Page {page} of {results.totalPages}
              </span>
              {page < results.totalPages && (
                <CustomShopLink
                  href={pageLink(page + 1)}
                  ariaLabel='Next search page'
                  prefetch={false}
                >
                  Next <ArrowRight size={18} />
                </CustomShopLink>
              )}
            </nav>
          )}
        </section>
      )}
    </main>
  );
}

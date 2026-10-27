'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ArrowLeft, Heart, ImageOff, LoaderCircle, Plus } from 'lucide-react';
import type { WishlistProduct } from '@/lib/wishlist/types';
import CustomShopLink from '../HelperComponents/CustomShopLink';
import GlobalProductPrice from '../GlobalShopComponents/GlobalProductPrice';
import styles from './Wishlist.module.css';

interface WishlistViewProps {
  items: WishlistProduct[];
  loading: boolean;
  error: string | null;
  authRequired: boolean;
  pendingProductIds: string[];
  onRetry: () => void;
  onRemove: (productId: string) => void;
  onAddToCart: (item: WishlistProduct) => void;
}

function ProductImage({ item }: { item: WishlistProduct }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);

  return (
    <div className={styles.thumbnail}>
      {item.image && failedSource !== item.image ? (
        <Image
          src={item.image}
          alt=''
          fill
          sizes='(min-width: 768px) 120px, 76px'
          className={styles.image}
          onError={() => setFailedSource(item.image)}
        />
      ) : (
        <ImageOff size={24} strokeWidth={1.5} aria-hidden='true' />
      )}
    </div>
  );
}

function LoadingRows() {
  return (
    <div role='status' aria-label='Loading your wishlist'>
      <span className={styles.srOnly}>Loading your wishlist…</span>
      <div className={styles.skeletonRows} aria-hidden='true'>
        {[0, 1].map((index) => (
          <div className={styles.skeletonRow} key={index}>
            <div className={`${styles.skeleton} ${styles.skeletonImage}`} />
            <div className={styles.skeletonDetails}>
              <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
              <div className={`${styles.skeleton} ${styles.skeletonPrice}`} />
            </div>
            <div className={`${styles.skeleton} ${styles.skeletonActions}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WishlistView({
  items,
  loading,
  error,
  authRequired,
  pendingProductIds,
  onRetry,
  onRemove,
  onAddToCart,
}: WishlistViewProps) {
  const showCount = !authRequired && (!loading || items.length > 0) && (!error || items.length > 0);

  return (
    <section className={styles.panel} aria-labelledby='wishlist-title' aria-busy={loading}>
      <header className={styles.header}>
        <CustomShopLink
          href='/shop/account-overview'
          className={styles.backLink}
          ariaLabel='Back to account overview'
        >
          <ArrowLeft size={28} strokeWidth={2.5} aria-hidden='true' />
        </CustomShopLink>
        <h1 id='wishlist-title' className={styles.title}>
          Wishlist{showCount ? ` (${items.length})` : ''}
          <Heart
            className={styles.headingHeart}
            fill='currentColor'
            strokeWidth={1.5}
            aria-hidden='true'
          />
        </h1>
      </header>

      {authRequired ? (
        <div className={styles.state}>
          <Heart size={42} strokeWidth={1.3} aria-hidden='true' />
          <h2>Keep your favorites close</h2>
          <p>Sign in to save products and view your wishlist.</p>
          <CustomShopLink
            href='/shop/auth/login'
            className={styles.primaryButton}
            ariaLabel='Sign in to view your wishlist'
          >
            Sign in
          </CustomShopLink>
        </div>
      ) : loading && items.length === 0 ? (
        <LoadingRows />
      ) : error && items.length === 0 ? (
        <div className={styles.state} role='alert'>
          <Heart size={42} strokeWidth={1.3} aria-hidden='true' />
          <h2>Your wishlist couldn’t load</h2>
          <p>{error}</p>
          <button type='button' className={styles.primaryButton} onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.state}>
          <Heart size={42} strokeWidth={1.3} aria-hidden='true' />
          <h2>Your wishlist is waiting</h2>
          <p>Tap the heart on a product to save it here.</p>
          <CustomShopLink
            href='/shop/categories/all'
            className={styles.primaryButton}
            ariaLabel='Browse all products'
          >
            Explore the shop
          </CustomShopLink>
        </div>
      ) : (
        <>
          {error && (
            <div className={styles.errorBanner} role='alert'>
              <p>{error}</p>
              <button type='button' onClick={onRetry} disabled={loading}>
                Try again
              </button>
            </div>
          )}
          <ul className={styles.items} aria-label='Saved products'>
            {items.map((item) => {
              const pending = pendingProductIds.includes(item.productId);
              const productHref = `/shop/product/${encodeURIComponent(item.productId)}`;

              return (
                <li className={styles.item} key={item.productId} aria-busy={pending}>
                  {item.available ? (
                    <CustomShopLink
                      href={productHref}
                      className={styles.imageLink}
                      ariaLabel={`View ${item.title}`}
                    >
                      <ProductImage item={item} />
                    </CustomShopLink>
                  ) : (
                    <ProductImage item={item} />
                  )}
                  <div className={styles.details}>
                    <h2 className={styles.productTitle}>
                      {item.available ? (
                        <CustomShopLink href={productHref} ariaLabel={`View ${item.title}`}>
                          {item.title}
                        </CustomShopLink>
                      ) : (
                        item.title
                      )}
                    </h2>
                    <p className={styles.price}>
                      {item.price !== null ? (
                        <GlobalProductPrice usdAmount={item.price} />
                      ) : (
                        <span className={styles.muted}>Price unavailable</span>
                      )}
                    </p>
                    {!item.available && <p className={styles.unavailable}>Currently unavailable</p>}
                  </div>
                  <div className={styles.actions}>
                    <button
                      type='button'
                      className={styles.primaryButton}
                      onClick={() => onAddToCart(item)}
                      disabled={!item.available || pending}
                      aria-label={`Choose options for ${item.title} before adding to cart`}
                    >
                      Add to Cart <Plus size={15} strokeWidth={2.5} aria-hidden='true' />
                    </button>
                    <button
                      type='button'
                      className={styles.removeButton}
                      onClick={() => onRemove(item.productId)}
                      disabled={pending}
                      aria-label={`Remove ${item.title} from wishlist`}
                    >
                      {pending && (
                        <LoaderCircle size={15} className={styles.spinner} aria-hidden='true' />
                      )}
                      {pending ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className={styles.optionsHint}>Choose your product options before adding to cart.</p>
          <span className={styles.srOnly} role='status'>
            {loading
              ? 'Updating your wishlist…'
              : `${items.length} saved ${items.length === 1 ? 'product' : 'products'}.`}
          </span>
        </>
      )}
    </section>
  );
}

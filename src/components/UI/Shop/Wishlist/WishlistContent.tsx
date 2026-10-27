'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useAuthStore from '@/stores/authStore';
import { useWishlist } from '@/stores/shop_stores/use-wishlist';
import WishlistView from './WishlistView';
import WishlistCartDialog from './WishlistCartDialog';

export default function WishlistContent() {
  const userId = useAuthStore((state) => state.userSessionInfo?.user_id ?? null);
  const wishlist = useWishlist((state) => state.wishlist);
  const isLoading = useWishlist((state) => state.isLoading);
  const error = useWishlist((state) => state.error);
  const authRequired = useWishlist((state) => state.authRequired);
  const pendingProductIds = useWishlist((state) => state.pendingProductIds);
  const getWishlist = useWishlist((state) => state.getWishlist);
  const clearWishlist = useWishlist((state) => state.clearWishlist);
  const removeWishlistItem = useWishlist((state) => state.removeWishlistItem);
  const [loadedOwner, setLoadedOwner] = useState<string | null | undefined>(undefined);
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const cartTrigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    clearWishlist();

    void getWishlist().then(() => {
      if (!cancelled) setLoadedOwner(userId);
    });

    return () => {
      cancelled = true;
      clearWishlist();
    };
  }, [clearWishlist, getWishlist, userId]);

  const ownerMatches = loadedOwner === userId && (!userId || wishlist?.userId === userId);
  const items = ownerMatches && !authRequired ? (wishlist?.data ?? []) : [];
  const activeItem = items.find((item) => item.productId === activeProductId) ?? null;
  const closeCartDialog = useCallback(() => {
    setActiveProductId(null);
    requestAnimationFrame(() => cartTrigger.current?.focus());
  }, []);

  return (
    <>
      <WishlistView
        items={items}
        loading={loadedOwner !== userId || isLoading}
        error={loadedOwner === userId ? error : null}
        authRequired={loadedOwner === userId && authRequired}
        pendingProductIds={pendingProductIds}
        onRetry={() => void getWishlist()}
        onRemove={(id) => void removeWishlistItem(id)}
        onAddToCart={(item) => {
          cartTrigger.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
          setActiveProductId(item.productId);
        }}
      />
      <WishlistCartDialog item={activeItem} onClose={closeCartDialog} />
    </>
  );
}

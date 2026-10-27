import type { WishlistMutationResponse, WishlistResponse } from '@/lib/wishlist/types';

export class WishlistRequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function requestWishlist<T>(body?: {
  action: 'add' | 'remove';
  product_ids: string[];
}): Promise<T> {
  const response = await fetch('/next-api/shop/wishlist', {
    method: body ? 'POST' : 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.success !== true) {
    throw new WishlistRequestError(
      typeof payload?.message === 'string'
        ? payload.message
        : 'We could not reach your wishlist. Please try again.',
      response.status,
    );
  }
  return payload as T;
}

export const fetchUserWishlist = () => requestWishlist<WishlistResponse>();

export const addToWishlist = (product_ids: string[]) =>
  requestWishlist<WishlistMutationResponse>({ action: 'add', product_ids });

export const removeFromWishlist = (product_ids: string[]) =>
  requestWishlist<WishlistMutationResponse>({ action: 'remove', product_ids });

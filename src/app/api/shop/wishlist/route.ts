import { NextResponse } from 'next/server';
import { getServerSessionState } from '@/lib/session/server-session';
import { authenticatedDjangoFetch } from '@/lib/auth/authenticated-django-fetch';
import { AccountRequestError } from '@/lib/auth/errors';
import { isSameOriginMutation } from '@/lib/auth/request-origin';
import {
  isRecord,
  normalizeWishlistProductIds,
  parseWishlistMutationBody,
  WishlistPayloadError,
} from '@/lib/wishlist/normalize';
import { resolveWishlistProduct } from '@/lib/wishlist/server-products';

const privateHeaders = { 'Cache-Control': 'private, no-store' };

function failure(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status, headers: privateHeaders });
}

async function requestWishlist(path: string, body?: { product_ids: string[] }) {
  const response = await authenticatedDjangoFetch(`/wishlist/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  }, { writable: true, retryUnauthorized: true });

  if (!response.ok) {
    return {
      response: failure(
        response.status === 401
          ? 'Sign in to view and manage your wishlist.'
          : response.status === 403
            ? 'You do not have permission to access this wishlist.'
            : 'The wishlist service is temporarily unavailable. Please try again.',
        response.status === 401 || response.status === 403 ? response.status : 502,
      ),
    };
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload) || payload.success !== true) {
    return { response: failure('The wishlist service could not complete your request. Please try again.', 502) };
  }
  return { payload };
}

export async function GET() {
  try {
    const result = await requestWishlist('get-wishlist');
    if (result.response) return result.response;
    const session = await getServerSessionState();
    const ids = normalizeWishlistProductIds(result.payload);
    const data = await Promise.all(ids.map(resolveWishlistProduct));

    return NextResponse.json(
      { success: true, status: 200, message: 'Wishlist retrieved.', data, userId: session.userID },
      { headers: privateHeaders },
    );
  } catch (error) {
    if (error instanceof AccountRequestError) return failure(error.message, error.status);
    return failure(
      error instanceof WishlistPayloadError
        ? error.message
        : 'We could not load your wishlist. Please try again.',
      502,
    );
  }
}

export async function POST(request: Request) {
  try {
    if (
      !isSameOriginMutation(request) ||
      !request.headers.get('content-type')?.toLowerCase().startsWith('application/json')
    ) {
      return failure('Submit wishlist changes from this shop.', 403);
    }

    let body;
    try {
      body = parseWishlistMutationBody(await request.json());
    } catch {
      return failure('Provide an add or remove action and valid product IDs.', 400);
    }

    const result = await requestWishlist(
      body.action === 'add' ? 'add-product' : 'remove-products',
      { product_ids: body.product_ids },
    );
    if (result.response) return result.response;
    const session = await getServerSessionState();

    return NextResponse.json(
      {
        success: true,
        message: body.action === 'add' ? 'Product added to wishlist.' : 'Product removed from wishlist.',
        userId: session.userID,
      },
      { headers: privateHeaders },
    );
  } catch (error) {
    if (error instanceof AccountRequestError) return failure(error.message, error.status);
    return failure('We could not update your wishlist. Please try again.', 502);
  }
}

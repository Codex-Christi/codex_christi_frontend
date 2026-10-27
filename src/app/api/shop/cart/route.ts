import { NextResponse } from 'next/server';
import { getServerSessionState } from '@/lib/session/server-session';
import { refreshSession } from '@/lib/session/main-session';
import { authenticatedDjangoFetch } from '@/lib/auth/authenticated-django-fetch';
import { AccountRequestError } from '@/lib/auth/errors';
import { isSameOriginMutation } from '@/lib/auth/request-origin';
import { readDjangoJson } from '@/lib/django/request';
import {
  CartProtocolError,
  cartDjangoRequest,
  isCartOwnerId,
  parseCartMutation,
  readRemoteCart,
} from '@/lib/cart/protocol';

const privateHeaders = { 'Cache-Control': 'private, no-store' };
const maxBodyBytes = 64 * 1024;

function failure(message: string, status: number, uncertain = false) {
  return NextResponse.json(
    { success: false, message, uncertain },
    { status, headers: privateHeaders },
  );
}

async function requireOwner(ownerId: unknown) {
  if (!isCartOwnerId(ownerId)) throw new CartProtocolError('Sign in to sync your cart.', 401);
  let session = await getServerSessionState();
  if (!session.isAuthenticated || !session.mainAccessToken) {
    const refreshed = await refreshSession();
    if (!refreshed.success) {
      throw new AccountRequestError(
        refreshed.unavailable ? 'unavailable' : 'sign_in_required',
        refreshed.unavailable
          ? 'Your saved cart is temporarily unavailable.'
          : 'Sign in to sync your cart.',
        refreshed.unavailable ? 503 : 401,
      );
    }
    session = await getServerSessionState();
  }
  if (!session.isAuthenticated || !session.userID) {
    throw new CartProtocolError('Sign in to sync your cart.', 401);
  }
  if (session.userID !== ownerId) {
    throw new CartProtocolError('Your account changed. Reload your cart before syncing.', 409);
  }
  return ownerId;
}

async function upstreamFailure(response: Response, write: boolean) {
  const { status } = response;
  await response.body?.cancel().catch(() => undefined);
  return failure(
    status === 404
      ? 'This saved cart item could not be found. Refresh your cart.'
      : 'Your saved cart is temporarily unavailable. Please try again.',
    status >= 400 && status < 500 ? status : 502,
    write && (status >= 500 || status === 408),
  );
}

export async function GET(request: Request) {
  try {
    const ownerId = await requireOwner(request.headers.get('x-cart-owner'));
    const response = await authenticatedDjangoFetch('/cart/my-cart', {}, { writable: true });
    if (!response.ok) return upstreamFailure(response, false);
    const items = readRemoteCart(await readDjangoJson(response), ownerId);
    return NextResponse.json({ success: true, ownerId, items }, { headers: privateHeaders });
  } catch (error) {
    return failure(
      error instanceof AccountRequestError || error instanceof CartProtocolError
        ? error.message
        : 'Your saved cart could not be loaded.',
      error instanceof AccountRequestError || error instanceof CartProtocolError
        ? error.status
        : 502,
    );
  }
}

async function readMutation(request: Request) {
  if (Number(request.headers.get('content-length')) > maxBodyBytes) {
    throw new CartProtocolError('This cart change is too large.', 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new CartProtocolError('Provide a cart change.', 400);
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    bytes += next.value.byteLength;
    if (bytes > maxBodyBytes) {
      await reader.cancel();
      throw new CartProtocolError('This cart change is too large.', 413);
    }
    text += decoder.decode(next.value, { stream: true });
  }
  try {
    return parseCartMutation(JSON.parse(text + decoder.decode()));
  } catch (error) {
    if (error instanceof CartProtocolError) throw error;
    throw new CartProtocolError('Provide a valid cart change.', 400);
  }
}

export async function POST(request: Request) {
  let sent = false;
  try {
    if (
      !isSameOriginMutation(request) ||
      !request.headers.get('content-type')?.startsWith('application/json')
    ) {
      return failure('Submit cart changes from this shop.', 403);
    }
    const mutation = await readMutation(request);
    const ownerId = await requireOwner(mutation.ownerId);
    const { path, init } = cartDjangoRequest(mutation);
    sent = true;
    // No automatic mutation replay: an interrupted additive request can have already applied.
    const response = await authenticatedDjangoFetch(path, init, { writable: true });
    if (!response.ok) return upstreamFailure(response, true);
    const payload = await readDjangoJson(response);
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('success' in payload) ||
      payload.success !== true
    ) {
      return failure(
        'Your saved cart did not confirm this change. Review it before retrying.',
        502,
        true,
      );
    }
    return NextResponse.json({ success: true, ownerId }, { headers: privateHeaders });
  } catch (error) {
    const known = error instanceof AccountRequestError || error instanceof CartProtocolError;
    return failure(
      known
        ? error.message
        : 'Your saved cart did not confirm this change. Review it before retrying.',
      known ? error.status : 502,
      sent && !known,
    );
  }
}

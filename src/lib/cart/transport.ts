import type { CartVariant, CartWriteKind } from './types';
import { isCartOwnerId } from './protocol';
import { normalizeCartLine } from './model';

export class CartTransportError extends Error {
  constructor(
    message: string,
    public status = 0,
    public uncertain = false,
  ) {
    super(message);
    this.name = 'CartTransportError';
  }
}

const endpoint = '/next-api/shop/cart';

async function requestCart(
  ownerId: string,
  body?: { action: CartWriteKind; item: unknown },
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  if (!isCartOwnerId(ownerId)) throw new CartTransportError('A signed-in cart is required.', 401);
  if (signal?.aborted) throw new CartTransportError('Cart sync was cancelled.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 20_000);
  let sent = false;
  try {
    sent = true;
    const response = await fetch(endpoint, {
      method: body ? 'POST' : 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'X-Cart-Owner': ownerId,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify({ ownerId, ...body }) } : {}),
    });
    const value: unknown = await response.json().catch(() => null);
    const payload =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
    if (!response.ok || payload?.success !== true) {
      throw new CartTransportError(
        typeof payload?.message === 'string'
          ? payload.message
          : 'Your changes are on this device, but cart sync could not be confirmed.',
        response.status,
        Boolean(body) &&
          (typeof payload?.uncertain === 'boolean'
            ? payload.uncertain
            : response.status >= 500 || response.ok),
      );
    }
    if (payload.ownerId !== ownerId) {
      throw new CartTransportError(
        'Your account changed. Reload your cart before syncing.',
        409,
        Boolean(body),
      );
    }
    return payload;
  } catch (error) {
    if (error instanceof CartTransportError) throw error;
    throw new CartTransportError(
      'Your changes are on this device. We could not confirm the connection to your saved cart.',
      0,
      Boolean(body) && sent,
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

export const cartTransport = {
  async read(ownerId: string, signal?: AbortSignal): Promise<CartVariant[]> {
    const payload = await requestCart(ownerId, undefined, signal);
    if (!Array.isArray(payload.items) || payload.items.length > 1000) {
      throw new CartTransportError('Your saved cart returned an unsupported item list.', 502);
    }
    const items: CartVariant[] = [];
    const seen = new Set<string>();
    for (const value of payload.items) {
      const line = normalizeCartLine(value);
      if (!line || seen.has(line.variantId)) {
        throw new CartTransportError('Your saved cart contains an unreadable item.', 502);
      }
      seen.add(line.variantId);
      items.push(line);
    }
    return items;
  },
  async write(ownerId: string, action: CartWriteKind, line: CartVariant, signal?: AbortSignal) {
    const item =
      action === 'remove'
        ? { variantId: line.variantId }
        : action === 'update'
          ? { variantId: line.variantId, quantity: line.quantity }
          : line;
    await requestCart(ownerId, { action, item }, signal);
  },
};

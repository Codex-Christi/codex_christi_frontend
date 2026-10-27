import { isCartQuantity, isCartVariantId, normalizeCartLine } from './model';
import type { CartVariant, CartWriteKind } from './types';

export class CartProtocolError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
    this.name = 'CartProtocolError';
  }
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function isCartOwnerId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$/.test(value);
}

/** Django cart metadata is a display cache; checkout still resolves trusted prices separately. */
export function readRemoteCart(payload: unknown, ownerId: string): CartVariant[] {
  if (!record(payload) || payload.success !== true || !record(payload.data)) {
    throw new CartProtocolError('The saved cart could not be read. Please try again.');
  }
  const { data } = payload;
  if (data.user !== undefined && data.user !== ownerId) {
    throw new CartProtocolError('Your account changed. Reload your cart before syncing.', 409);
  }
  if (!Array.isArray(data.items) || data.items.length > 1000) {
    throw new CartProtocolError('The saved cart contains an unsupported item list.');
  }
  const seen = new Set<string>();
  const items: CartVariant[] = [];
  for (const value of data.items) {
    if (!record(value) || !isCartVariantId(value.variant_id)) {
      throw new CartProtocolError('A saved cart item could not be read.');
    }
    if (seen.has(value.variant_id)) {
      throw new CartProtocolError('The saved cart contains duplicate item references.');
    }
    seen.add(value.variant_id);
    // The API permits zero-quantity records; they do not represent cart contents.
    if (value.quantity === 0) continue;
    const detail = value.item_detail;
    if (!record(detail)) throw new CartProtocolError('A saved cart item is missing its details.');
    const title = typeof detail.title === 'string' ? detail.title : value.title;
    const line = normalizeCartLine({
      variantId: value.variant_id,
      quantity: value.quantity,
      title,
      slug: typeof value.slug === 'string' && value.slug ? value.slug : value.variant_id,
      itemDetail: detail,
    });
    if (!line) throw new CartProtocolError('A saved cart item contains invalid details.');
    items.push(line);
  }
  return items;
}

export type CartMutation = {
  ownerId: string;
  action: CartWriteKind;
  item: {
    variantId: string;
    quantity?: number;
    slug?: string;
    itemDetail?: CartVariant['itemDetail'];
  };
};

export function parseCartMutation(value: unknown): CartMutation {
  if (
    !record(value) ||
    !isCartOwnerId(value.ownerId) ||
    !['add', 'update', 'remove'].includes(String(value.action)) ||
    !record(value.item) ||
    !isCartVariantId(value.item.variantId)
  ) {
    throw new CartProtocolError('Provide a valid cart change and account.', 400);
  }
  const { ownerId, item } = value;
  const variantId = value.item.variantId;
  const action = value.action as CartWriteKind;
  if (action === 'remove') return { ownerId, action, item: { variantId } };
  if (!isCartQuantity(item.quantity)) {
    throw new CartProtocolError('Choose a positive whole-number quantity.', 400);
  }
  if (action === 'update') {
    return { ownerId, action, item: { variantId, quantity: item.quantity } };
  }
  const line = normalizeCartLine(item);
  if (!line) throw new CartProtocolError('This item is missing valid product details.', 400);
  return {
    ownerId,
    action,
    item: {
      variantId: line.variantId,
      quantity: line.quantity,
      slug: line.slug,
      itemDetail: { ...line.itemDetail, title: line.title },
    },
  };
}

export function cartDjangoRequest(mutation: CartMutation) {
  // Verified with a disposable cart: add increments, update sets an absolute quantity,
  // and removing an already absent variant succeeds. Never replay an uncertain add.
  const path = {
    add: '/cart/add-items',
    update: '/cart/update-items',
    remove: '/cart/remove-items',
  }[mutation.action];
  return {
    path,
    init: {
      method: mutation.action === 'update' ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [mutation.item] }),
    } satisfies RequestInit,
  };
}

export class WishlistPayloadError extends Error {}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isWishlistProductId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 200 &&
    value.trim() === value &&
    /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value)
  );
}

function productIdFromReference(value: unknown): string {
  if (isWishlistProductId(value)) return value;
  if (isRecord(value)) {
    const id = value.external_product_id ?? value.product_id ?? value._id;
    if (isWishlistProductId(id)) return id;
  }
  throw new WishlistPayloadError('The wishlist contains a product without a valid storefront ID.');
}

/** Validate structured backend data. The Swagger data:string field is intentionally not JSON-parsed. */
export function normalizeWishlistProductIds(payload: unknown): string[] {
  if (!isRecord(payload) || payload.success !== true) {
    throw new WishlistPayloadError('The wishlist service did not confirm a successful response.');
  }

  const data = payload.data;
  let ids: string[];
  if (Array.isArray(data)) {
    ids = data.map(productIdFromReference);
  } else if (isRecord(data) && Object.hasOwn(data, 'product_ids')) {
    const products = data.product_ids;
    if (Array.isArray(products)) {
      ids = products.map(productIdFromReference);
    } else if (isRecord(products)) {
      ids = Object.entries(products).map(([key, value]) => {
        if (!isWishlistProductId(key)) {
          throw new WishlistPayloadError('The wishlist contains an invalid storefront ID.');
        }
        // A keyed membership map or keyed product records can both be validated explicitly.
        if (value === true) return key;
        if (isRecord(value)) {
          const embeddedId = value.external_product_id ?? value.product_id ?? value._id;
          if (embeddedId === undefined || productIdFromReference(value) === key) return key;
        }
        throw new WishlistPayloadError('The wishlist product mapping has an unsupported format.');
      });
    } else {
      throw new WishlistPayloadError('The wishlist product list has an unsupported format.');
    }
  } else {
    throw new WishlistPayloadError(
      'The wishlist service returned an unsupported format. Please try again; the backend response may need updating.',
    );
  }

  return [...new Set(ids)];
}

export function parseWishlistMutationBody(payload: unknown) {
  if (
    !isRecord(payload) ||
    (payload.action !== 'add' && payload.action !== 'remove') ||
    !Array.isArray(payload.product_ids) ||
    payload.product_ids.length === 0 ||
    payload.product_ids.length > 100 ||
    !payload.product_ids.every(isWishlistProductId)
  ) {
    throw new WishlistPayloadError('Provide an add or remove action and valid product IDs.');
  }
  return {
    action: payload.action as 'add' | 'remove',
    product_ids: [...new Set(payload.product_ids)] as string[],
  };
}

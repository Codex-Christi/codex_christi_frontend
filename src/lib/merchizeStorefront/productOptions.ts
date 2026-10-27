import type { ProductVariantsInterface } from './productTypes';
import type { ProductUnavailabilityReason } from './destinationAvailability';

export type ProductOptionsResponse = ProductVariantsInterface & {
  countryName?: string;
  unavailabilityReason?: ProductUnavailabilityReason;
  verificationIncomplete?: boolean;
};

export class ProductOptionsError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ProductOptionsError';
  }
}

export async function fetchProductOptions(
  productId: string,
  country: string,
  signal: AbortSignal,
  request: typeof fetch = fetch,
): Promise<ProductOptionsResponse> {
  const response = await request(
    `/next-api/shop/products/${encodeURIComponent(productId)}/variants?country=${encodeURIComponent(country)}`,
    { cache: 'no-store', credentials: 'same-origin', signal },
  );
  const payload: unknown = await response.json().catch((error: unknown) => {
    if (signal.aborted) throw error;
    return null;
  });
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : 'Unable to load product options.';
    throw new ProductOptionsError(message, response.status === 429 || response.status >= 500);
  }
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('data' in payload) ||
    !Array.isArray(payload.data)
  ) {
    throw new ProductOptionsError('Product options could not be verified. Please try again.', true);
  }
  const result = payload as ProductOptionsResponse;
  if (result.verificationIncomplete && result.data.length === 0) {
    throw new ProductOptionsError(
      'Product availability could not be verified. Please try again.',
      true,
    );
  }
  return result;
}

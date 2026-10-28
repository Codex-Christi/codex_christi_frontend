export const CHECKOUT_REQUEST_TIMEOUT_MS = 15_000;

export class CheckoutRequestTimeoutError extends Error {
  constructor() {
    super('The checkout request is taking too long. Check its status before trying again.');
    this.name = 'CheckoutRequestTimeoutError';
  }
}

/** Bound the response and body read even when a transport ignores cancellation. */
export async function boundedCheckoutRequest<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = CHECKOUT_REQUEST_TIMEOUT_MS,
  cancellation?: AbortSignal,
): Promise<T> {
  if (cancellation?.aborted) throw new DOMException('Checkout request cancelled.', 'AbortError');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: (() => void) | undefined;
  const deadline = new Promise<never>((_, reject) => {
    cancel = () => {
      reject(new DOMException('Checkout request cancelled.', 'AbortError'));
      controller.abort();
    };
    cancellation?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => {
      reject(new CheckoutRequestTimeoutError());
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      Promise.resolve().then(() => {
        if (controller.signal.aborted)
          throw new DOMException('Checkout request cancelled.', 'AbortError');
        return operation(controller.signal);
      }),
      deadline,
    ]);
  } finally {
    clearTimeout(timer);
    if (cancel) cancellation?.removeEventListener('abort', cancel);
  }
}

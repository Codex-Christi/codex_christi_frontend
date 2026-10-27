import { NextResponse } from 'next/server';
import { isSameOriginMutation } from '@/lib/auth/request-origin';

export class CheckoutRequestError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = 'INVALID_CHECKOUT_REQUEST',
  ) {
    super(message);
  }
}

export const checkoutPrivateHeaders = { 'Cache-Control': 'private, no-store' };

export function checkoutRequestFailure(error: unknown) {
  const known = error instanceof CheckoutRequestError;
  return NextResponse.json(
    {
      ok: false,
      message: known ? error.message : 'Checkout is temporarily unavailable. Please try again.',
      code: known ? error.code : 'CHECKOUT_UNAVAILABLE',
    },
    { status: known ? error.status : 503, headers: checkoutPrivateHeaders },
  );
}

export function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function checkoutString(value: unknown, max = 256): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    /[\u0000-\u001f]/u.test(value)
  )
    throw new CheckoutRequestError('A checkout field is missing or invalid.');
  return value.trim();
}

export function checkoutEmail(value: unknown) {
  const email = checkoutString(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email))
    throw new CheckoutRequestError('Enter a valid email address.');
  return email;
}

/** Bound the bytes while reading, including chunked requests without Content-Length. */
export async function readCheckoutBody(request: Request, limit = 64 * 1024) {
  if (!isSameOriginMutation(request))
    throw new CheckoutRequestError(
      'Reload checkout before trying again.',
      403,
      'CHECKOUT_ORIGIN_REJECTED',
    );
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    throw new CheckoutRequestError('A JSON checkout request is required.', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new CheckoutRequestError('A checkout request is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new CheckoutRequestError('This checkout request is too large.', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const body = record(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
    if (!body) throw new Error('object required');
    return body;
  } catch {
    throw new CheckoutRequestError('The checkout request could not be read.');
  }
}

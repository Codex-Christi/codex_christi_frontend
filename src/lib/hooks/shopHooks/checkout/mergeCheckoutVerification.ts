import type { DjangoOrderIntentAPIResponse } from './djangoOrderIntentMutationHooks';

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

/** Restores display fields only; payment authorization still requires the server's sealed proof. */
export function mergeCheckoutVerification(
  response: DjangoOrderIntentAPIResponse,
  createdIntent: unknown,
): DjangoOrderIntentAPIResponse {
  if (response.emailVerificationMethod !== 'next-otp') return response;
  const previous = record(createdIntent);
  const data = record(previous?.data);
  const verified = response.data;
  if (
    previous?.success !== true ||
    !data ||
    response.success !== true ||
    verified?.otp_status !== 'verified' ||
    !verified.id ||
    !verified.order_id ||
    data.id !== verified.id ||
    data.order_id !== verified.order_id ||
    typeof data.email !== 'string' ||
    typeof verified.email !== 'string' ||
    data.email.trim().toLowerCase() !== verified.email.trim().toLowerCase()
  )
    throw new Error('Checkout details changed. Please verify your email again.');

  return {
    ...response,
    data: { ...data, ...verified },
  };
}

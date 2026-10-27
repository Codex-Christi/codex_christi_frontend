import { normalizeCountryToIso3 } from '@/lib/utils/shop/checkout/normalizeCountryToIso3';

type CheckoutContact = {
  email?: string | null;
  delivery_address?: Partial<
    Record<
      | 'shipping_address_line_1'
      | 'shipping_address_line_2'
      | 'shipping_city'
      | 'shipping_state'
      | 'zip_code'
      | 'shipping_country',
      string | null
    >
  > | null;
};
type CheckoutVerification = {
  djangoOrderIntentUuid?: string | null;
  djangoOrderIntentOrderId?: string | null;
  djangoOrderIntentVerifiedAt?: string | null;
  djangoOrderIntentVerifyPayload?: unknown;
};
const HOUR_MS = 60 * 60 * 1000;
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

function text(value: unknown, limit: number, optional = false): string | null {
  if (optional && (value == null || value === '')) return '';
  return typeof value === 'string' &&
    value.trim() &&
    value.length <= limit &&
    !/[\u0000-\u001f]/u.test(value)
    ? value.trim()
    : null;
}
function email(value: unknown) {
  const normalized = text(value, 254)?.toLowerCase();
  return normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized) ? normalized : null;
}
function addressIdentity(value: unknown, upstream = false) {
  const address = record(value);
  if (!address) return null;
  const fields = (
    upstream
      ? ['address', 'address_2', 'city', 'state', 'zip_code']
      : [
          'shipping_address_line_1',
          'shipping_address_line_2',
          'shipping_city',
          'shipping_state',
          'zip_code',
        ]
  ).map(
    (key, index) =>
      text(address[key], 500, index === 1)
        ?.replace(/\s+/gu, ' ')
        .toLowerCase() ?? null,
  );
  const country = normalizeCountryToIso3(
    text(address[upstream ? 'country' : 'shipping_country'], 500)?.replace(/\s+/gu, ' '),
  );
  return country && fields.every((field) => field !== null)
    ? JSON.stringify([...fields, country])
    : null;
}

/** Restores a UI step only. The payment endpoint still requires its signed server proof. */
export function canResumeVerifiedCheckout(
  checkout: CheckoutContact,
  intent: CheckoutVerification,
  now = Date.now(),
): boolean {
  const verifiedAt =
    typeof intent.djangoOrderIntentVerifiedAt === 'string'
      ? Date.parse(intent.djangoOrderIntentVerifiedAt)
      : NaN;
  const age = now - verifiedAt;
  if (!Number.isFinite(now) || !Number.isFinite(age) || age < 0 || age >= HOUR_MS) return false;
  const payload = record(intent.djangoOrderIntentVerifyPayload);
  const data = record(payload?.data);
  const uuid = text(intent.djangoOrderIntentUuid, 128);
  const orderId = text(intent.djangoOrderIntentOrderId, 128);
  const currentEmail = email(checkout.email);
  if (
    !uuid ||
    !orderId ||
    !currentEmail ||
    payload?.success !== true ||
    data?.otp_status !== 'verified' ||
    text(data.id, 128) !== uuid ||
    text(data.order_id, 128) !== orderId ||
    email(data.email) !== currentEmail
  )
    return false;
  const address = addressIdentity(checkout.delivery_address);
  return address !== null && address === addressIdentity(data, true);
}

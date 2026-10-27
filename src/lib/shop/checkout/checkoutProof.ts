import 'server-only';
import { createHash, createHmac } from 'node:crypto';
import { decryptServerText, encryptServerText } from '@/lib/crypto/serverAesGcm';
import { normalizeCountryToIso3 } from '@/lib/utils/shop/checkout/normalizeCountryToIso3';
import { checkoutEmail, checkoutString, CheckoutRequestError, record } from './serverRequest';

export type CheckoutEmailProof = {
  browserId?: string;
  email: string;
  intentUuid: string;
  orderId: string;
  addressHash: string;
  verified: boolean;
};
type CheckoutGrant = {
  orderToken: string;
  mode: 'payment' | 'status';
  ownerId: string | null;
  viewerId: string | null;
};
type Envelope<T> = { value: T; expiresAt: number };
export const EMAIL_PROOF_SECONDS = 60 * 60;
export const CHECKOUT_GRANT_SECONDS = 30 * 24 * 60 * 60;
export const CHECKOUT_BROWSER_COOKIE = 'checkout-browser';

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || Buffer.byteLength(value) < 32)
    throw new Error('Checkout signing secret is not configured.');
  return value;
}

export function sealCheckoutValue<T>(value: T, purpose: string, seconds: number) {
  return encryptServerText(JSON.stringify({ value, expiresAt: Date.now() + seconds * 1000 }), {
    secret: secret(),
    purpose: `checkout/${purpose}`,
  });
}

export function openCheckoutValue<T>(token: string | undefined, purpose: string): T | null {
  if (!token || token.length > 3800) return null;
  try {
    const envelope = JSON.parse(
      decryptServerText(token, { secret: secret(), purpose: `checkout/${purpose}` }),
    ) as Envelope<T>;
    return Number.isFinite(envelope.expiresAt) && envelope.expiresAt > Date.now()
      ? envelope.value
      : null;
  } catch {
    return null;
  }
}

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export const emailProofCookieName = (id: string) => `checkout-proof-${digest(id).slice(0, 20)}`;
export const checkoutGrantCookieName = (id: string) => `checkout-access-${digest(id).slice(0, 20)}`;

export function checkoutAddressHash(value: unknown, django = false) {
  const address = record(value);
  const field = (key: string, optional = false) => {
    const raw = address?.[key];
    return optional && (raw == null || raw === '')
      ? ''
      : checkoutString(raw, 500).replace(/\s+/gu, ' ').toLowerCase();
  };
  const country = normalizeCountryToIso3(field(django ? 'country' : 'shipping_country'));
  if (!country) throw new Error('Invalid checkout country.');
  return digest(
    JSON.stringify([
      field(django ? 'address' : 'shipping_address_line_1'),
      field(django ? 'address_2' : 'shipping_address_line_2', true),
      field(django ? 'city' : 'shipping_city'),
      field(django ? 'state' : 'shipping_state'),
      field('zip_code'),
      country,
    ]),
  );
}

export function readUpstreamEmailProof(
  payload: unknown,
  expectedEmail: string,
): CheckoutEmailProof {
  const response = record(payload);
  const data = record(response?.data);
  if (
    response?.success !== true ||
    !data ||
    !['pending', 'verified'].includes(String(data.otp_status)) ||
    checkoutEmail(data.email) !== expectedEmail
  )
    throw new Error('Django checkout verification response is incomplete.');
  return {
    email: expectedEmail,
    intentUuid: checkoutString(data.id, 128),
    orderId: checkoutString(data.order_id, 128),
    addressHash: checkoutAddressHash(data, true),
    verified: data.otp_status === 'verified',
  };
}

export function matchesCheckoutProof(
  proof: CheckoutEmailProof | null,
  email: unknown,
  address: unknown,
) {
  return Boolean(
    proof?.verified &&
    proof.email === checkoutEmail(email) &&
    proof.addressHash === checkoutAddressHash(address),
  );
}

export function checkoutAttemptToken(attemptId: unknown, proof: CheckoutEmailProof) {
  const id = checkoutString(attemptId, 64);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id))
    throw new CheckoutRequestError(
      'Review the order again before paying.',
      400,
      'CHECKOUT_ATTEMPT_REQUIRED',
    );
  const browserId = checkoutString(proof.browserId, 64);
  const hex = createHmac('sha256', secret())
    .update(JSON.stringify(['checkout/attempt', id.toLowerCase(), browserId]))
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function canAccessCheckout(
  grant: CheckoutGrant | null,
  row: { orderToken: string; userId: string | null },
  userId: string | null,
  payment = false,
) {
  if (row.userId && row.userId === userId) return true;
  return Boolean(
    grant &&
    grant.orderToken === row.orderToken &&
    (!payment || grant.mode === 'payment') &&
    grant.ownerId === row.userId &&
    (!row.userId || (!payment && grant.mode === 'status' && grant.viewerId === userId)),
  );
}

export function createCheckoutGrant(
  row: { orderToken: string; userId: string | null },
  mode: CheckoutGrant['mode'],
  viewerId: string | null = null,
) {
  return sealCheckoutValue<CheckoutGrant>(
    { orderToken: row.orderToken, ownerId: row.userId, mode, viewerId },
    'access',
    CHECKOUT_GRANT_SECONDS,
  );
}

export type { CheckoutGrant };

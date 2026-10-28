import 'server-only';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { isCompletedPayPalCapture } from '@/lib/paypal/txLedger/captureCompletion';
import { findUnresolvedPaidCheckoutsByEmail } from './findUnresolvedPaidCheckouts';
import { normalizeRecoveryEmail } from './recoveryOtpUtils';

/** Exact rows must be filtered by server access policy or email OTP before exposing any details. */
export async function findEmailRecoveryCheckouts(email: string, orderToken?: string) {
  const normalizedEmail = normalizeRecoveryEmail(email);
  if (!orderToken) return findUnresolvedPaidCheckoutsByEmail(normalizedEmail);
  const row = await paypalTxLedger.paypalIntent.findUnique({ where: { orderToken } });
  return row &&
    normalizeRecoveryEmail(row.customerEmail) === normalizedEmail &&
    isCompletedPayPalCapture(row.capturePayload)
    ? [row]
    : [];
}

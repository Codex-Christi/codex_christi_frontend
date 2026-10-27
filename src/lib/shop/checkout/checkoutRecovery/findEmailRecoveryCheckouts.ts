import 'server-only';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { isCompletedPayPalCapture } from '@/lib/paypal/txLedger/captureCompletion';
import { findUnresolvedPaidCheckoutsByEmail } from './findUnresolvedPaidCheckouts';

/** Call exact-order lookup only after email OTP verification; never expose existence beforehand. */
export async function findEmailRecoveryCheckouts(email: string, orderToken?: string) {
  if (!orderToken) return findUnresolvedPaidCheckoutsByEmail(email);
  const row = await paypalTxLedger.paypalIntent.findUnique({ where: { orderToken } });
  return row &&
    row.customerEmail.trim().toLowerCase() === email &&
    isCompletedPayPalCapture(row.capturePayload)
    ? [row]
    : [];
}

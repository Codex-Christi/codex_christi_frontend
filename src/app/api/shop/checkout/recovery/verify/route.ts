import { NextResponse } from 'next/server';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import {
  checkoutEmail,
  checkoutString,
  CheckoutRequestError,
  checkoutPrivateHeaders,
  checkoutRequestFailure,
  readCheckoutBody,
} from '@/lib/shop/checkout/serverRequest';
import { consumeRecoveryChallenge } from '@/lib/shop/checkout/checkoutRecovery/recoveryChallenges';
import { findEmailRecoveryCheckouts } from '@/lib/shop/checkout/checkoutRecovery/findEmailRecoveryCheckouts';
import { mapRecoveryCheckoutSummary } from '@/lib/shop/checkout/checkoutRecovery/mapRecoveryCheckoutSummary';
import { grantCheckoutAccess } from '@/lib/shop/checkout/serverAccess';
import { getServerSessionState } from '@/lib/session/server-session';

export async function POST(request: Request) {
  try {
    const body = await readCheckoutBody(request, 2048);
    const email = checkoutEmail(body.email);
    const orderToken = body.orderToken == null ? undefined : checkoutString(body.orderToken, 128);
    const otp = checkoutString(body.otp, 6);
    if (!/^\d{6}$/u.test(otp)) throw new CheckoutRequestError('Enter the six-digit recovery code.');
    const result = await consumeRecoveryChallenge(email, otp);
    if (result !== 'verified')
      throw new CheckoutRequestError(
        result === 'limited'
          ? 'Too many incorrect attempts. Request a new code.'
          : 'This recovery code is expired or invalid.',
        result === 'limited' ? 429 : 400,
      );
    const unresolved = await findEmailRecoveryCheckouts(email, orderToken);
    const response = NextResponse.json(
      { ok: true, recoveryVerified: true, checkouts: unresolved.map(mapRecoveryCheckoutSummary) },
      { headers: checkoutPrivateHeaders },
    );
    const rows = await paypalTxLedger.paypalIntent.findMany({
      where: { orderToken: { in: unresolved.map((row) => row.orderToken) } },
      select: { orderToken: true, userId: true },
    });
    const session = await getServerSessionState();
    for (const row of rows)
      grantCheckoutAccess(
        response,
        request,
        row,
        'status',
        session.isAuthenticated ? (session.userID ?? null) : null,
      );
    return response;
  } catch (error) {
    return checkoutRequestFailure(error);
  }
}

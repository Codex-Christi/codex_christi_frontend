import { NextResponse } from 'next/server';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { getServerSessionState } from '@/lib/session/server-session';
import {
  checkoutString,
  CheckoutRequestError,
  checkoutPrivateHeaders,
  checkoutRequestFailure,
  readCheckoutBody,
} from '@/lib/shop/checkout/serverRequest';
import { grantCheckoutAccess, requireCheckoutAccess } from '@/lib/shop/checkout/serverAccess';

export async function POST(request: Request) {
  try {
    const body = await readCheckoutBody(request, 2048);
    const orderToken = checkoutString(body.orderToken, 128);
    const session = await getServerSessionState();
    if (!session.isAuthenticated || !session.userID)
      throw new CheckoutRequestError(
        'Sign in before linking this checkout.',
        401,
        'CHECKOUT_SIGN_IN_REQUIRED',
      );
    const row = await paypalTxLedger.paypalIntent.findUnique({
      where: { orderToken },
      select: { orderToken: true, userId: true },
    });
    if (!row)
      throw new CheckoutRequestError(
        'This checkout could not be reopened.',
        404,
        'CHECKOUT_NOT_FOUND',
      );
    await requireCheckoutAccess(row, true, request);
    if (row.userId !== session.userID)
      throw new CheckoutRequestError(
        'This checkout could not be linked to your account.',
        403,
        'CHECKOUT_ACCESS_REQUIRED',
      );
    return grantCheckoutAccess(
      NextResponse.json({ ok: true, orderToken }, { headers: checkoutPrivateHeaders }),
      request,
      row,
      'payment',
      session.userID,
    );
  } catch (error) {
    return checkoutRequestFailure(error);
  }
}

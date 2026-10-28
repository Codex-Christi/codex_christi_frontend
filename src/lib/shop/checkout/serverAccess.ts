import 'server-only';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import { getServerSessionState } from '@/lib/session/server-session';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import { shouldUseSecureCookie } from '@/lib/session/session-cookies';
import { CheckoutRequestError } from './serverRequest';
import { enforceCheckoutCookieBudget } from './checkoutCookieBudget';
import {
  canAccessCheckout,
  CHECKOUT_GRANT_SECONDS,
  checkoutGrantCookieName,
  createCheckoutGrant,
  openCheckoutValue,
  type CheckoutGrant,
  type CheckoutEmailProof,
  emailProofCookieName,
  CHECKOUT_BROWSER_COOKIE,
  bindCheckoutEmailProofOwner,
  isCheckoutEmailProofOwner,
} from './checkoutProof';
import { writeCheckoutEmailProof } from './serverEmailProofCookies';

export async function requireCheckoutAccess(
  row: { orderToken: string; userId: string | null; djangoOrderIntentUuid?: string | null },
  payment = false,
  request?: Request,
) {
  const session = await getServerSessionState();
  const cookieStore = await cookies();
  const cookie = cookieStore.get(checkoutGrantCookieName(row.orderToken));
  const grant = openCheckoutValue<CheckoutGrant>(cookie?.value, 'access');
  const userId = session.isAuthenticated ? (session.userID ?? null) : null;
  if (!canAccessCheckout(grant, row, userId, payment))
    throw new CheckoutRequestError(
      'Verify your email to reopen this checkout.',
      403,
      'CHECKOUT_ACCESS_REQUIRED',
    );
  // Ownership changes are explicit POST operations. Reading payment status never mutates it.
  if (request && userId && !row.userId && grant?.mode === 'payment') {
    const claim = await paypalTxLedger.paypalIntent.updateMany({
      where: { orderToken: row.orderToken, userId: null },
      data: { userId },
    });
    if (claim.count !== 1) {
      const current = await paypalTxLedger.paypalIntent.findUnique({
        where: { orderToken: row.orderToken },
        select: { userId: true },
      });
      if (current?.userId !== userId)
        throw new CheckoutRequestError(
          'This checkout belongs to another account. Reopen it with the original account.',
          403,
          'CHECKOUT_ACCESS_REQUIRED',
        );
    }
    row.userId = userId;
    enforceCheckoutCookieBudget(
      cookieStore,
      request,
      checkoutGrantCookieName(row.orderToken),
      'access',
    );
    cookieStore.set(
      checkoutGrantCookieName(row.orderToken),
      createCheckoutGrant(row, 'payment', userId),
      {
        httpOnly: true,
        secure: shouldUseSecureCookie(request.headers),
        sameSite: 'lax',
        path: '/',
        maxAge: CHECKOUT_GRANT_SECONDS,
      },
    );
    if (row.djangoOrderIntentUuid) {
      const proof = openCheckoutValue<CheckoutEmailProof>(
        cookieStore.get(emailProofCookieName(row.djangoOrderIntentUuid))?.value,
        'email-proof',
      );
      const browserId = openCheckoutValue<string>(
        cookieStore.get(CHECKOUT_BROWSER_COOKIE)?.value,
        'browser',
      );
      if (
        proof?.verified &&
        proof.intentUuid === row.djangoOrderIntentUuid &&
        proof.browserId === browserId &&
        isCheckoutEmailProofOwner(proof, userId)
      ) {
        const bound = bindCheckoutEmailProofOwner(proof, userId);
        if (bound !== proof) writeCheckoutEmailProof(cookieStore, request, bound);
      }
    }
  }
}

export function grantCheckoutAccess(
  response: NextResponse,
  request: Request,
  row: { orderToken: string; userId: string | null },
  mode: 'payment' | 'status' = 'payment',
  viewerId: string | null = null,
) {
  response.headers.set('Cache-Control', 'private, no-store');
  enforceCheckoutCookieBudget(
    response.cookies,
    request,
    checkoutGrantCookieName(row.orderToken),
    'access',
  );
  response.cookies.set(
    checkoutGrantCookieName(row.orderToken),
    createCheckoutGrant(row, mode, viewerId),
    {
      httpOnly: true,
      secure: shouldUseSecureCookie(request.headers),
      sameSite: 'lax',
      path: '/',
      maxAge: CHECKOUT_GRANT_SECONDS,
    },
  );
  return response;
}

import 'server-only';
import type { NextResponse } from 'next/server';
import { shouldUseSecureCookie } from '@/lib/session/session-cookies';
import { enforceCheckoutCookieBudget } from './checkoutCookieBudget';
import {
  CHECKOUT_BROWSER_COOKIE,
  CHECKOUT_GRANT_SECONDS,
  EMAIL_PROOF_SECONDS,
  emailProofCookieName,
  sealCheckoutValue,
  type CheckoutEmailProof,
} from './checkoutProof';

export function writeCheckoutEmailProof(
  writer: Pick<NextResponse['cookies'], 'getAll' | 'set'>,
  request: Request,
  proof: CheckoutEmailProof,
  setBrowser = false,
) {
  const options = {
    httpOnly: true,
    secure: shouldUseSecureCookie(request.headers),
    sameSite: 'lax' as const,
    path: '/',
  };
  if (setBrowser)
    writer.set(
      CHECKOUT_BROWSER_COOKIE,
      sealCheckoutValue(proof.browserId, 'browser', CHECKOUT_GRANT_SECONDS),
      { ...options, maxAge: CHECKOUT_GRANT_SECONDS },
    );
  const name = emailProofCookieName(proof.intentUuid);
  enforceCheckoutCookieBudget(writer, request, name, 'proof');
  writer.set(name, sealCheckoutValue(proof, 'email-proof', EMAIL_PROOF_SECONDS), {
    ...options,
    maxAge: EMAIL_PROOF_SECONDS,
  });
}

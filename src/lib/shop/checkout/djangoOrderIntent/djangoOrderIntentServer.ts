import 'server-only';

import { generateSignatureHeaders } from '@/lib/hooks/shopHooks/checkout/helpers/generateSignatureHeaders';
import { getServerDjangoApiBaseUrl } from '@/lib/django/getServerDjangoApiBaseUrl';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import {
  checkoutEmail,
  checkoutString,
  readCheckoutBody,
  checkoutPrivateHeaders,
  checkoutRequestFailure,
  CheckoutRequestError,
  record,
} from '../serverRequest';
import {
  EMAIL_PROOF_SECONDS,
  emailProofCookieName,
  readUpstreamEmailProof,
  sealCheckoutValue,
  openCheckoutValue,
  CHECKOUT_BROWSER_COOKIE,
  CHECKOUT_GRANT_SECONDS,
} from '../checkoutProof';
import { shouldUseSecureCookie } from '@/lib/session/session-cookies';
import { enforceCheckoutCookieBudget } from '../checkoutCookieBudget';

type DjangoOrderIntentEndpoint =
  '/orders/intent' | '/orders/intent/verify' | '/orders/intent/resend-otp';

export async function postToDjangoOrderIntent<TBody>(
  endpoint: DjangoOrderIntentEndpoint,
  body: TBody,
) {
  const djangoBaseUrl = getServerDjangoApiBaseUrl();

  const response = await fetch(`${djangoBaseUrl}${endpoint}`, {
    method: 'POST',
    headers: await generateSignatureHeaders(),
    body: JSON.stringify(body),
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });

  const text = await response.text();
  if (text.length > 64 * 1024) throw new Error('Invalid Django checkout response.');
  return { response, payload: JSON.parse(text) as unknown };
}

/** Only a successful upstream response may create trusted email/address evidence. */
export async function handleDjangoOrderIntent(
  request: Request,
  endpoint: DjangoOrderIntentEndpoint,
) {
  try {
    const input = await readCheckoutBody(request, 8 * 1024);
    const email = checkoutEmail(input.email);
    const body: Record<string, string> = { email };
    if (endpoint === '/orders/intent') {
      for (const field of ['first_name', 'address', 'city', 'state', 'zip_code', 'country'])
        body[field] = checkoutString(input[field], 500);
      for (const field of ['last_name', 'address_2', 'phone']) {
        if (input[field] != null && input[field] !== '')
          body[field] = checkoutString(input[field], 500);
      }
    } else if (endpoint === '/orders/intent/verify') {
      body.otp = checkoutString(input.otp, 12);
      if (!/^\d{6}$/u.test(body.otp))
        throw new CheckoutRequestError('Enter the six-digit verification code.');
      body.order_id = checkoutString(input.order_id, 128);
    }
    const { response, payload } = await postToDjangoOrderIntent(endpoint, body);
    if (!response.ok)
      return NextResponse.json(
        {
          success: false,
          message:
            response.status === 429
              ? 'Please wait before requesting another code.'
              : 'Email verification could not be completed. Check your details and try again.',
        },
        { status: response.status >= 500 ? 503 : response.status, headers: checkoutPrivateHeaders },
      );
    if (record(payload)?.success !== true)
      throw new CheckoutRequestError(
        'Email verification could not be completed. Check your details and try again.',
      );
    const result = NextResponse.json(payload, { headers: checkoutPrivateHeaders });
    if (
      endpoint !== '/orders/intent/resend-otp' &&
      record(record(payload)?.data)?.otp_status === 'verified'
    ) {
      const proof = readUpstreamEmailProof(payload, email);
      if (
        endpoint === '/orders/intent/verify' &&
        (!proof.verified || proof.orderId !== body.order_id)
      )
        throw new Error('Django verification identity mismatch.');
      const browser =
        openCheckoutValue<string>(
          (await cookies()).get(CHECKOUT_BROWSER_COOKIE)?.value,
          'browser',
        ) ?? randomUUID();
      proof.browserId = browser;
      result.cookies.set(
        CHECKOUT_BROWSER_COOKIE,
        sealCheckoutValue(browser, 'browser', CHECKOUT_GRANT_SECONDS),
        {
          httpOnly: true,
          secure: shouldUseSecureCookie(request.headers),
          sameSite: 'lax',
          path: '/',
          maxAge: CHECKOUT_GRANT_SECONDS,
        },
      );
      const proofCookieName = emailProofCookieName(proof.intentUuid);
      enforceCheckoutCookieBudget(result.cookies, request, proofCookieName, 'proof');
      result.cookies.set(
        proofCookieName,
        sealCheckoutValue(proof, 'email-proof', EMAIL_PROOF_SECONDS),
        {
          httpOnly: true,
          secure: shouldUseSecureCookie(request.headers),
          sameSite: 'lax',
          path: '/',
          maxAge: EMAIL_PROOF_SECONDS,
        },
      );
    }
    if (
      endpoint === '/orders/intent/verify' &&
      record(record(payload)?.data)?.otp_status !== 'verified'
    )
      throw new CheckoutRequestError('This verification code is expired or invalid.');
    return result;
  } catch (error) {
    return checkoutRequestFailure(error);
  }
}

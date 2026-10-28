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
  emailProofCookieName,
  readUpstreamEmailProof,
  openCheckoutValue,
  checkoutAddressHash,
  CHECKOUT_BROWSER_COOKIE,
  bindCheckoutEmailProofOwner,
  type CheckoutEmailProof,
} from '../checkoutProof';
import { getServerSessionState } from '@/lib/session/server-session';
import { writeCheckoutEmailProof } from '../serverEmailProofCookies';
import {
  consumeRecoveryChallenge,
  reserveRecoveryChallenge,
  RECOVERY_OTP_EXPIRY_MINUTES,
} from '../checkoutRecovery/recoveryChallenges';
import {
  canReuseCheckoutEmailProof,
  checkoutEmailChallengeScope,
  matchesCheckoutEmailIdentity,
} from './checkoutEmailVerification';

type DjangoOrderIntentEndpoint =
  '/orders/intent' | '/orders/intent/verify' | '/orders/intent/resend-otp';

export async function postToDjangoOrderIntent<TBody>(
  endpoint: DjangoOrderIntentEndpoint,
  body: TBody,
) {
  const response = await fetch(`${getServerDjangoApiBaseUrl()}${endpoint}`, {
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

function saveEmailProof(response: NextResponse, request: Request, proof: CheckoutEmailProof) {
  writeCheckoutEmailProof(response.cookies, request, proof, true);
  return response;
}

async function sendCheckoutEmailCode(proof: CheckoutEmailProof) {
  const challenge = await reserveRecoveryChallenge(proof.email, checkoutEmailChallengeScope(proof));
  if (!challenge.otp && !challenge.hasActiveChallenge)
    throw new CheckoutRequestError(
      'Please wait a moment before requesting another checkout verification code.',
      429,
    );
  if (challenge.otp) {
    const { sendMailFromPrimaryAgent } = await import('@/lib/zeptomail/sendMailFromPrimaryAgent');
    await sendMailFromPrimaryAgent({
      emailReceipents: [{ email_address: { address: proof.email, name: 'Checkout customer' } }],
      subject: 'Your Codex Christi checkout verification code',
      // The only interpolated value is a server-generated six-digit code.
      htmlbody: `<h1>Verify your checkout email</h1><p>Use this code to continue your Codex Christi checkout:</p><p style="font-size:28px;letter-spacing:6px;font-weight:bold">${challenge.otp}</p><p>This code expires in ${RECOVERY_OTP_EXPIRY_MINUTES} minutes. Do not share it with anyone.</p>`,
    });
  }
  return challenge;
}

function verifiedEmailResponse(proof: CheckoutEmailProof) {
  return NextResponse.json(
    {
      success: true,
      emailVerificationMethod: 'next-otp',
      message: 'Email verified. You can continue checkout.',
      data: {
        id: proof.intentUuid,
        email: proof.email,
        order_id: proof.orderId,
        otp_status: 'verified',
      },
    },
    { headers: checkoutPrivateHeaders },
  );
}

type EmailVerificationDependencies = {
  getCookies: () => Promise<Pick<Awaited<ReturnType<typeof cookies>>, 'get'>>;
  post: typeof postToDjangoOrderIntent;
  sendCode: typeof sendCheckoutEmailCode;
  consumeCode: typeof consumeRecoveryChallenge;
  getUserId: () => Promise<string | null>;
};

const emailVerificationDependencies: EmailVerificationDependencies = {
  getCookies: cookies,
  post: postToDjangoOrderIntent,
  sendCode: sendCheckoutEmailCode,
  consumeCode: consumeRecoveryChallenge,
  getUserId: async () => {
    const session = await getServerSessionState();
    return session.isAuthenticated ? (session.userID ?? null) : null;
  },
};

/** Django supplies intent identity; a browser-bound code or existing proof supplies email ownership. */
export async function handleDjangoOrderIntent(
  request: Request,
  endpoint: DjangoOrderIntentEndpoint,
  dependencies = emailVerificationDependencies,
) {
  try {
    const input = await readCheckoutBody(request, 8 * 1024);
    const email = checkoutEmail(input.email);
    const cookieStore = await dependencies.getCookies();
    const userId = await dependencies.getUserId();
    const browserId = openCheckoutValue<string>(
      cookieStore.get(CHECKOUT_BROWSER_COOKIE)?.value,
      'browser',
    );
    const body: Record<string, string> = { email };
    let pending: CheckoutEmailProof | null = null;

    if (endpoint === '/orders/intent') {
      for (const field of ['first_name', 'address', 'city', 'state', 'zip_code', 'country'])
        body[field] = checkoutString(input[field], 500);
      for (const field of ['last_name', 'address_2', 'phone']) {
        if (input[field] != null && input[field] !== '')
          body[field] = checkoutString(input[field], 500);
      }
    } else {
      const intentUuid = checkoutString(input.intentUuid, 128);
      const orderId =
        endpoint === '/orders/intent/verify' ? checkoutString(input.order_id, 128) : undefined;
      pending = openCheckoutValue<CheckoutEmailProof>(
        cookieStore.get(emailProofCookieName(intentUuid))?.value,
        'email-proof',
      );
      if (!matchesCheckoutEmailIdentity(pending, { browserId, intentUuid, email, orderId, userId }))
        throw new CheckoutRequestError('Reopen checkout and request a new verification code.', 409);
      if (endpoint === '/orders/intent/verify') {
        body.otp = checkoutString(input.otp, 6);
        if (!/^\d{6}$/u.test(body.otp))
          throw new CheckoutRequestError('Enter the six-digit verification code.');
        body.order_id = orderId!;
      } else if (pending.verified) {
        throw new CheckoutRequestError('This checkout email is already verified.', 409);
      }

      if (pending.verificationMethod === 'next-otp') {
        if (endpoint === '/orders/intent/resend-otp') {
          const challenge = await dependencies.sendCode(pending);
          return NextResponse.json(
            {
              success: true,
              emailVerificationMethod: 'next-otp',
              message: challenge.otp
                ? 'A new checkout verification code has been sent.'
                : 'Use your latest checkout code or wait before requesting another.',
              resendAvailableInSeconds: challenge.cooldown,
            },
            { headers: checkoutPrivateHeaders },
          );
        }
        const proof = pending;
        const bound = bindCheckoutEmailProofOwner(proof, userId);
        if (proof.verified)
          return bound === proof
            ? verifiedEmailResponse(proof)
            : saveEmailProof(verifiedEmailResponse(proof), request, bound);
        if (!proof.verified) {
          const result = await dependencies.consumeCode(
            email,
            body.otp,
            checkoutEmailChallengeScope(proof),
          );
          if (result !== 'verified')
            throw new CheckoutRequestError(
              result === 'limited'
                ? 'Too many incorrect attempts. Request a new code.'
                : 'This verification code is expired or invalid.',
              result === 'limited' ? 429 : 400,
            );
        }
        return saveEmailProof(verifiedEmailResponse(proof), request, { ...bound, verified: true });
      }
    }

    const { response, payload } = await dependencies.post(endpoint, body);
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
    if (endpoint === '/orders/intent/resend-otp')
      return NextResponse.json(payload, { headers: checkoutPrivateHeaders });

    const incoming = readUpstreamEmailProof(payload, email);
    if (endpoint === '/orders/intent/verify') {
      if (
        !pending ||
        !incoming.verified ||
        !canReuseCheckoutEmailProof({ ...pending, verified: true }, incoming, browserId, userId)
      )
        throw new CheckoutRequestError(
          'The checkout details changed. Request a new verification code.',
          409,
        );
      return saveEmailProof(
        NextResponse.json(payload, { headers: checkoutPrivateHeaders }),
        request,
        {
          ...incoming,
          browserId: browserId!,
          verificationMethod: 'django-otp',
          ownerId: userId,
        },
      );
    }
    if (incoming.addressHash !== checkoutAddressHash(body, true))
      throw new CheckoutRequestError(
        'The delivery details could not be confirmed. Check them and try again.',
        409,
      );
    const existing = openCheckoutValue<CheckoutEmailProof>(
      cookieStore.get(emailProofCookieName(incoming.intentUuid))?.value,
      'email-proof',
    );
    if (incoming.verified && canReuseCheckoutEmailProof(existing, incoming, browserId, userId)) {
      const result = NextResponse.json(payload, { headers: checkoutPrivateHeaders });
      const bound = bindCheckoutEmailProofOwner(existing!, userId);
      return bound === existing ? result : saveEmailProof(result, request, bound);
    }

    const proof: CheckoutEmailProof = {
      ...incoming,
      browserId: browserId ?? randomUUID(),
      verified: false,
      verificationMethod: incoming.verified ? 'next-otp' : 'django-otp',
      ownerId: userId,
    };
    let responsePayload = payload;
    if (incoming.verified) {
      const challenge = await dependencies.sendCode(proof);
      responsePayload = {
        ...record(payload),
        emailVerificationMethod: 'next-otp',
        resendAvailableInSeconds: challenge.cooldown,
        message: challenge.otp
          ? 'A checkout verification code has been sent to your email.'
          : 'Use the latest checkout code or request another when the wait ends.',
        data: {
          ...record(record(payload)?.data),
          otp_status: 'pending',
          has_pending_otp: true,
          otp_time_remaining: Math.max(
            0,
            Math.ceil((challenge.expiresAt.getTime() - Date.now()) / 1000),
          ),
          otp_expires_at: challenge.expiresAt.toISOString(),
        },
      };
    }
    return saveEmailProof(
      NextResponse.json(responsePayload, { headers: checkoutPrivateHeaders }),
      request,
      proof,
    );
  } catch (error) {
    return checkoutRequestFailure(error);
  }
}

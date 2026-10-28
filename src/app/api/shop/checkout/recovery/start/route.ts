import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  checkoutEmail,
  checkoutString,
  checkoutPrivateHeaders,
  checkoutRequestFailure,
  readCheckoutBody,
  CheckoutRequestError,
} from '@/lib/shop/checkout/serverRequest';
import { findEmailRecoveryCheckouts } from '@/lib/shop/checkout/checkoutRecovery/findEmailRecoveryCheckouts';
import {
  reserveRecoveryChallenge,
  RECOVERY_OTP_EXPIRY_MINUTES,
} from '@/lib/shop/checkout/checkoutRecovery/recoveryChallenges';
import { getServerSessionState } from '@/lib/session/server-session';
import {
  CHECKOUT_BROWSER_COOKIE,
  checkoutGrantCookieName,
  emailProofCookieName,
  openCheckoutValue,
  bindCheckoutEmailProofOwner,
  type CheckoutEmailProof,
  type CheckoutGrant,
} from '@/lib/shop/checkout/checkoutProof';
import {
  canReviewRecoveryCheckout,
  canReviewRecoveryEmailProof,
  recoveryReviewResponse,
} from '@/lib/shop/checkout/checkoutRecovery/reviewPolicy';
import { mapRecoveryCheckoutSummary } from '@/lib/shop/checkout/checkoutRecovery/mapRecoveryCheckoutSummary';
import { grantCheckoutAccess } from '@/lib/shop/checkout/serverAccess';
import { writeCheckoutEmailProof } from '@/lib/shop/checkout/serverEmailProofCookies';

export async function POST(request: Request) {
  try {
    const body = await readCheckoutBody(request, 2048);
    const email = checkoutEmail(body.email);
    const orderToken = body.orderToken == null ? undefined : checkoutString(body.orderToken, 128);
    const mode = body.mode ?? 'send-code';
    if (mode !== 'review' && mode !== 'send-code')
      throw new CheckoutRequestError('Choose a valid checkout recovery action.');
    const recipientName =
      body.recipientName == null ? undefined : checkoutString(body.recipientName, 200);

    if (mode === 'review') {
      const intentUuid = body.intentUuid == null ? undefined : checkoutString(body.intentUuid, 128);
      const [session, cookieStore, rows] = await Promise.all([
        getServerSessionState(),
        cookies(),
        findEmailRecoveryCheckouts(email, orderToken),
      ]);
      const userId = session.isAuthenticated ? (session.userID ?? null) : null;
      const browserId = openCheckoutValue<string>(
        cookieStore.get(CHECKOUT_BROWSER_COOKIE)?.value,
        'browser',
      );
      const emailProof = intentUuid
        ? openCheckoutValue<CheckoutEmailProof>(
            cookieStore.get(emailProofCookieName(intentUuid))?.value,
            'email-proof',
          )
        : null;
      const reviewAccess = { email, userId, browserId, intentUuid, emailProof };
      const authorized = rows.filter((row) =>
        canReviewRecoveryCheckout(row, {
          ...reviewAccess,
          grant: openCheckoutValue<CheckoutGrant>(
            cookieStore.get(checkoutGrantCookieName(row.orderToken))?.value,
            'access',
          ),
        }),
      );
      const response = NextResponse.json(
        recoveryReviewResponse(authorized.map(mapRecoveryCheckoutSummary)),
        { headers: checkoutPrivateHeaders },
      );
      if (emailProof && canReviewRecoveryEmailProof(reviewAccess)) {
        const boundProof = bindCheckoutEmailProofOwner(emailProof, userId);
        if (boundProof !== emailProof)
          writeCheckoutEmailProof(response.cookies, request, boundProof);
      }
      for (const row of authorized) grantCheckoutAccess(response, request, row, 'status', userId);
      return response;
    }

    // Explicit code requests disclose neither existence nor ownership, including exact orders.
    const challenge = await reserveRecoveryChallenge(email);
    if (!challenge.otp && !challenge.hasActiveChallenge)
      throw new CheckoutRequestError('Please wait before requesting another recovery code.', 429);
    if (challenge.otp) {
      const [{ sendMailFromPrimaryAgent }, { buildRecoveryOtpEmailHtml }] = await Promise.all([
        import('@/lib/zeptomail/sendMailFromPrimaryAgent'),
        import('@/lib/shop/checkout/checkoutRecovery/recoveryOtpEmailTemplate'),
      ]);
      await sendMailFromPrimaryAgent({
        emailReceipents: [
          { email_address: { address: email, name: recipientName ?? email.split('@')[0] } },
        ],
        subject: 'Your Codex Christi checkout recovery code',
        htmlbody: buildRecoveryOtpEmailHtml({
          otp: challenge.otp,
          recipientName,
          expiresInMinutes: RECOVERY_OTP_EXPIRY_MINUTES,
        }),
      });
    }
    return NextResponse.json(
      {
        ok: true,
        recoveryRequired: true,
        expiresInSeconds: Math.max(
          0,
          Math.ceil((challenge.expiresAt.getTime() - Date.now()) / 1000),
        ),
        resendAvailableInSeconds: challenge.cooldown,
        message: challenge.otp
          ? undefined
          : 'Use the latest recovery code or wait before requesting another.',
      },
      { headers: checkoutPrivateHeaders },
    );
  } catch (error) {
    return checkoutRequestFailure(error);
  }
}

import { NextResponse } from 'next/server';
import {
  checkoutEmail,
  checkoutString,
  checkoutPrivateHeaders,
  checkoutRequestFailure,
  readCheckoutBody,
} from '@/lib/shop/checkout/serverRequest';
import { findUnresolvedPaidCheckoutsByEmail } from '@/lib/shop/checkout/checkoutRecovery/findUnresolvedPaidCheckouts';
import {
  reserveRecoveryChallenge,
  RECOVERY_OTP_EXPIRY_MINUTES,
} from '@/lib/shop/checkout/checkoutRecovery/recoveryChallenges';

export async function POST(request: Request) {
  try {
    const body = await readCheckoutBody(request, 2048);
    const email = checkoutEmail(body.email);
    const orderToken = body.orderToken == null ? undefined : checkoutString(body.orderToken, 128);
    const recipientName =
      body.recipientName == null ? undefined : checkoutString(body.recipientName, 200);
    // An exact-order recovery request gets the same response regardless of existence or owner.
    // Only the OTP verification route may look up that order.
    const unresolved = orderToken ? null : await findUnresolvedPaidCheckoutsByEmail(email);
    if (unresolved && !unresolved.length)
      return NextResponse.json(
        { ok: true, recoveryRequired: false },
        { headers: checkoutPrivateHeaders },
      );
    const challenge = await reserveRecoveryChallenge(email);
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

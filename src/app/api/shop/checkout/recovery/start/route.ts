import { NextResponse } from 'next/server';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import {
  createRecoveryOtp,
  getRecoveryOtpExpiry,
  hashRecoveryOtp,
  normalizeRecoveryEmail,
} from '@/lib/shop/checkout/checkoutRecovery/recoveryOtpUtils';
import { findUnresolvedPaidCheckoutsByEmail } from '@/lib/shop/checkout/checkoutRecovery/findUnresolvedPaidCheckouts';

const RECOVERY_OTP_EXPIRY_MINUTES = 10;

export async function POST(req: Request) {
  const startedAt = Date.now();

  try {
    const body = (await req.json()) as {
      email?: string;
      recipientName?: string;
    };

    if (!body.email) {
      return NextResponse.json({ ok: false, message: 'Email is required.' }, { status: 400 });
    }

    const email = normalizeRecoveryEmail(body.email);
    const lookupStartedAt = Date.now();
    const unresolvedCheckouts = await findUnresolvedPaidCheckoutsByEmail(email);
    const lookupMs = Date.now() - lookupStartedAt;

    if (!unresolvedCheckouts.length) {
      console.info('[checkout-recovery.start.timing]', {
        recoveryRequired: false,
        lookupMs,
        totalMs: Date.now() - startedAt,
      });

      return NextResponse.json({
        ok: true,
        recoveryRequired: false,
      });
    }

    const otp = createRecoveryOtp();
    const otpHash = hashRecoveryOtp(otp);
    const expiresAt = getRecoveryOtpExpiry(RECOVERY_OTP_EXPIRY_MINUTES);

    const challengeCreateStartedAt = Date.now();
    await paypalTxLedger.checkoutRecoveryOtpChallenge.create({
      data: {
        email,
        otpHash,
        expiresAt,
      },
    });
    const challengeCreateMs = Date.now() - challengeCreateStartedAt;

    const mailImportStartedAt = Date.now();
    const [{ sendMailFromPrimaryAgent }, { buildRecoveryOtpEmailHtml }] = await Promise.all([
      import('@/lib/zeptomail/sendMailFromPrimaryAgent'),
      import('@/lib/shop/checkout/checkoutRecovery/recoveryOtpEmailTemplate'),
    ]);
    const mailImportMs = Date.now() - mailImportStartedAt;

    const mailStartedAt = Date.now();
    await sendMailFromPrimaryAgent({
      emailReceipents: [
        {
          email_address: {
            address: email,
            name: body.recipientName ?? email.split('@')[0],
          },
        },
      ],
      subject: 'Your Codex Christi checkout recovery code',
      htmlbody: buildRecoveryOtpEmailHtml({
        otp,
        recipientName: body.recipientName,
        expiresInMinutes: RECOVERY_OTP_EXPIRY_MINUTES,
      }),
    });
    const mailMs = Date.now() - mailStartedAt;

    console.info('[checkout-recovery.start.timing]', {
      recoveryRequired: true,
      lookupMs,
      challengeCreateMs,
      mailImportMs,
      mailMs,
      totalMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      ok: true,
      recoveryRequired: true,
      expiresInMinutes: RECOVERY_OTP_EXPIRY_MINUTES,
    });
  } catch (error) {
    console.error('[checkout-recovery.start.failed]', error);

    return NextResponse.json(
      {
        ok: false,
        message: 'Unable to start checkout recovery.',
      },
      { status: 500 },
    );
  }
}

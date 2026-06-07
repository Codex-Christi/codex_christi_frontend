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
const RECOVERY_OTP_RESEND_COOLDOWN_SECONDS = 60;
const MAX_ACTIVE_RECOVERY_OTP_CHALLENGES = 3;

function logRecoveryStartTiming(payload: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'production') {
    console.info('[checkout-recovery.start.timing]', payload);
  }
}

function secondsUntil(date: Date) {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000));
}

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
      logRecoveryStartTiming({
        recoveryRequired: false,
        lookupMs,
        totalMs: Date.now() - startedAt,
      });

      return NextResponse.json({
        ok: true,
        recoveryRequired: false,
      });
    }

    const now = new Date();
    const activeChallenges = await paypalTxLedger.checkoutRecoveryOtpChallenge.findMany({
      where: {
        email,
        consumedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: MAX_ACTIVE_RECOVERY_OTP_CHALLENGES,
    });
    const latestActiveChallenge = activeChallenges[0];
    const secondsSinceLatestChallenge = latestActiveChallenge
      ? Math.floor((now.getTime() - latestActiveChallenge.createdAt.getTime()) / 1000)
      : null;
    const resendAvailableInSeconds =
      secondsSinceLatestChallenge === null
        ? 0
        : Math.max(0, RECOVERY_OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLatestChallenge);

    if (
      latestActiveChallenge &&
      (resendAvailableInSeconds > 0 ||
        activeChallenges.length >= MAX_ACTIVE_RECOVERY_OTP_CHALLENGES)
    ) {
      logRecoveryStartTiming({
        recoveryRequired: true,
        reusedActiveChallenge: true,
        activeChallengeCount: activeChallenges.length,
        resendAvailableInSeconds,
        lookupMs,
        totalMs: Date.now() - startedAt,
      });

      return NextResponse.json({
        ok: true,
        recoveryRequired: true,
        expiresInSeconds: secondsUntil(latestActiveChallenge.expiresAt),
        resendAvailableInSeconds,
        message:
          resendAvailableInSeconds > 0
            ? 'A recovery code was already sent recently.'
            : 'Use the latest recovery code or wait for it to expire before requesting another.',
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

    logRecoveryStartTiming({
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
      resendAvailableInSeconds: RECOVERY_OTP_RESEND_COOLDOWN_SECONDS,
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

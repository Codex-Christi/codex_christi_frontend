import { NextResponse } from 'next/server';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import {
  hashRecoveryOtp,
  normalizeRecoveryEmail,
} from '@/lib/shop/checkout/checkoutRecovery/recoveryOtpUtils';
import { findUnresolvedPaidCheckoutsByEmail } from '@/lib/shop/checkout/checkoutRecovery/findUnresolvedPaidCheckouts';
import { mapRecoveryCheckoutSummary } from '@/lib/shop/checkout/checkoutRecovery/mapRecoveryCheckoutSummary';

const MAX_RECOVERY_OTP_ATTEMPTS = 5;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      email?: string;
      otp?: string;
    };

    if (!body.email || !body.otp) {
      return NextResponse.json(
        { ok: false, message: 'Email and OTP are required.' },
        { status: 400 },
      );
    }

    const email = normalizeRecoveryEmail(body.email);
    const otpHash = hashRecoveryOtp(body.otp);

    const challenge = await paypalTxLedger.checkoutRecoveryOtpChallenge.findFirst({
      where: {
        email,
        consumedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!challenge) {
      return NextResponse.json(
        { ok: false, message: 'This recovery code is expired or invalid.' },
        { status: 400 },
      );
    }

    if (challenge.attemptCount >= MAX_RECOVERY_OTP_ATTEMPTS) {
      return NextResponse.json(
        { ok: false, message: 'Too many incorrect attempts. Request a new code.' },
        { status: 429 },
      );
    }

    if (challenge.otpHash !== otpHash) {
      await paypalTxLedger.checkoutRecoveryOtpChallenge.update({
        where: {
          id: challenge.id,
        },
        data: {
          attemptCount: {
            increment: 1,
          },
        },
      });

      return NextResponse.json({ ok: false, message: 'Invalid recovery code.' }, { status: 400 });
    }

    await paypalTxLedger.checkoutRecoveryOtpChallenge.update({
      where: {
        id: challenge.id,
      },
      data: {
        consumedAt: new Date(),
      },
    });

    const unresolvedCheckouts = await findUnresolvedPaidCheckoutsByEmail(email);

    return NextResponse.json({
      ok: true,
      recoveryVerified: true,
      checkouts: unresolvedCheckouts.map(mapRecoveryCheckoutSummary),
    });
  } catch (error) {
    console.error('[checkout-recovery.verify.failed]', error);

    return NextResponse.json(
      {
        ok: false,
        message: 'Unable to verify checkout recovery code.',
      },
      { status: 500 },
    );
  }
}

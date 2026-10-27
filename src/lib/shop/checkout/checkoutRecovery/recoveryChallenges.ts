import 'server-only';
import { paypalTxLedger } from '@/lib/prisma/shop/paypal/paypalTxLedger';
import type { Prisma } from '@/lib/prisma/shop/paypal/txLedger/generated/paypalTxLedger/client';
import { createRecoveryOtp, hashRecoveryOtp } from './recoveryOtpUtils';

export const RECOVERY_OTP_EXPIRY_MINUTES = 10;
export const RECOVERY_OTP_RESEND_SECONDS = 60;
const MAX_ACTIVE_CHALLENGES = 3;
const MAX_ATTEMPTS = 5;

/** A database transaction lock covers all instances/tabs, without a schema change. */
async function withEmailLock<T>(email: string, run: (tx: Prisma.TransactionClient) => Promise<T>) {
  return paypalTxLedger.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`checkout-recovery:${email}`}, 0))`;
    return run(tx);
  });
}

export async function reserveRecoveryChallenge(email: string) {
  return withEmailLock(email, async (tx) => {
    const now = new Date();
    const active = await tx.checkoutRecoveryOtpChallenge.findMany({
      where: { email, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      take: MAX_ACTIVE_CHALLENGES,
    });
    // Consuming/exhausting a code must not bypass the send cooldown.
    const latest = await tx.checkoutRecoveryOtpChallenge.findFirst({
      where: { email },
      orderBy: { createdAt: 'desc' },
    });
    const cooldown = latest
      ? Math.max(
          0,
          RECOVERY_OTP_RESEND_SECONDS -
            Math.floor((now.getTime() - latest.createdAt.getTime()) / 1000),
        )
      : 0;
    if (latest && (cooldown > 0 || active.length >= MAX_ACTIVE_CHALLENGES))
      return { otp: null, expiresAt: latest.expiresAt, cooldown };
    const otp = createRecoveryOtp();
    const expiresAt = new Date(now.getTime() + RECOVERY_OTP_EXPIRY_MINUTES * 60_000);
    await tx.checkoutRecoveryOtpChallenge.create({
      data: { email, otpHash: hashRecoveryOtp(otp), expiresAt },
    });
    return { otp, expiresAt, cooldown: RECOVERY_OTP_RESEND_SECONDS };
  });
}

export async function consumeRecoveryChallenge(
  email: string,
  otp: string,
): Promise<'verified' | 'invalid' | 'limited'> {
  return withEmailLock(email, async (tx) => {
    const now = new Date();
    const challenge = await tx.checkoutRecoveryOtpChallenge.findFirst({
      where: { email, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge) return 'invalid';
    if (challenge.attemptCount >= MAX_ATTEMPTS) return 'limited';
    const verified = challenge.otpHash === hashRecoveryOtp(otp);
    const exhausted = challenge.attemptCount + 1 >= MAX_ATTEMPTS;
    // The lock serializes callers; the predicate also fences expiry and accidental stale updates.
    const result = await tx.checkoutRecoveryOtpChallenge.updateMany({
      where: {
        id: challenge.id,
        consumedAt: null,
        attemptCount: challenge.attemptCount,
        expiresAt: { gt: now },
      },
      data: { attemptCount: { increment: 1 }, consumedAt: verified || exhausted ? now : undefined },
    });
    if (result.count !== 1) return 'invalid';
    return verified ? 'verified' : exhausted ? 'limited' : 'invalid';
  });
}

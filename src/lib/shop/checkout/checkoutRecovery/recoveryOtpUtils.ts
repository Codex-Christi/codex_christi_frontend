import crypto from 'node:crypto';

function getRecoveryOtpHashSecret() {
  const secret =
    process.env.CHECKOUT_RECOVERY_OTP_SECRET ??
    process.env.SHOP_CHECKOUT_SERVER_ACTIONS_POST_PROCESSING_CRYPTO_SECRET;

  if (!secret) {
    throw new Error(
      'Missing CHECKOUT_RECOVERY_OTP_SECRET or SHOP_CHECKOUT_SERVER_ACTIONS_POST_PROCESSING_CRYPTO_SECRET',
    );
  }

  return secret;
}

export function normalizeRecoveryEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createRecoveryOtp(length = 6) {
  const max = 10 ** length;
  return crypto.randomInt(0, max).toString().padStart(length, '0');
}

export function hashRecoveryOtp(otp: string) {
  return crypto.createHmac('sha256', getRecoveryOtpHashSecret()).update(otp).digest('hex');
}

export function getRecoveryOtpExpiry(minutes = 10) {
  return new Date(Date.now() + minutes * 60_000);
}

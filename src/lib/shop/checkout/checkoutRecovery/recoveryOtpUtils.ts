import crypto from 'node:crypto';

export function normalizeRecoveryEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createRecoveryOtp(length = 6) {
  const max = 10 ** length;
  return crypto.randomInt(0, max).toString().padStart(length, '0');
}

export function hashRecoveryOtp(otp: string) {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export function getRecoveryOtpExpiry(minutes = 10) {
  return new Date(Date.now() + minutes * 60_000);
}

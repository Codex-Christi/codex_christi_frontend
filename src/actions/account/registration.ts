'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { djangoRequest, readDjangoJson, safeDjangoMessage } from '@/lib/django/request';
import { asRecord } from '@/lib/session/django-auth-response';
import { allowAuthAttempt } from '@/lib/auth/rate-limit';
import {
  emailSchema as email,
  otpSchema as otp,
  nameSchema,
  newPasswordSchema,
} from '@/lib/formSchemas/auth-fields';

const registration = z
  .object({
    first_name: nameSchema,
    last_name: nameSchema,
    email,
    password: newPasswordSchema,
  })
  .strict();
type Result = { success: true; email?: string } | { success: false; error: string };
const emailOnly = z.object({ email }).strict();
const verification = z.object({ email, otp }).strict();
const passwordReset = verification.extend({ password: newPasswordSchema });

async function submit(
  path: string,
  data: Record<string, string>,
  scope: string,
  resend = false,
): Promise<Result> {
  const h = await headers();
  if (
    !allowAuthAttempt('auth-ip', h.get('x-real-ip') ?? 'unknown', 40, 60_000) ||
    !allowAuthAttempt(
      scope,
      data.email.toLowerCase(),
      resend ? 1 : 10,
      resend ? 30_000 : 5 * 60_000,
    )
  ) {
    return { success: false, error: 'Too many attempts. Please wait before trying again.' };
  }
  try {
    const response = await djangoRequest(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data),
    });
    const payload = await readDjangoJson(response);
    // Code-request responses should not disclose whether an email has an account.
    if (resend && response.status === 404) return { success: true };
    if (!response.ok || asRecord(payload)?.success !== true)
      return {
        success: false,
        error:
          response.status >= 500
            ? 'The service is temporarily unavailable. Please try again.'
            : safeDjangoMessage(payload, 'Check the details and try again.'),
      };
    return { success: true, ...(scope === 'registration' ? { email: data.email } : {}) };
  } catch {
    return { success: false, error: 'The service is temporarily unavailable. Please try again.' };
  }
}

export async function registerAccount(input: unknown): Promise<Result> {
  const parsed = registration.safeParse(input);
  return parsed.success
    ? submit('/account/user-registration', parsed.data, 'registration')
    : { success: false, error: 'Check your name, email and password.' };
}
export async function verifyAccountCode(input: unknown): Promise<Result> {
  const parsed = verification.safeParse(input);
  return parsed.success
    ? submit('/account/otp/verify', parsed.data, 'verify-account')
    : { success: false, error: 'Enter a valid email and six-digit code.' };
}
export async function resendAccountCode(input: unknown): Promise<Result> {
  const parsed = emailOnly.safeParse(input);
  return parsed.success
    ? submit('/account/otp/resend', parsed.data, 'resend-account', true)
    : { success: false, error: 'Enter a valid email.' };
}
export async function requestPasswordCode(input: unknown): Promise<Result> {
  const parsed = emailOnly.safeParse(input);
  return parsed.success
    ? submit('/account/password-reset-otp', parsed.data, 'password-code', true)
    : { success: false, error: 'Enter a valid email.' };
}
export async function resetAccountPassword(input: unknown): Promise<Result> {
  const parsed = passwordReset.safeParse(input);
  return parsed.success
    ? submit('/account/forgotten-password-reset', parsed.data, 'reset-password')
    : { success: false, error: 'Check your email, code and new password.' };
}

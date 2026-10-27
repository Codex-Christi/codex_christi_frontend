'use server';

import { z } from 'zod';
import {
  submitRegistrationRequest as submit,
  type RegistrationResult as Result,
} from '@/lib/auth/registration-request';
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
const emailOnly = z.object({ email }).strict();
const verification = z.object({ email, otp }).strict();

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

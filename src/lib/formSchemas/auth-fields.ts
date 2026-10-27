import { z } from 'zod';

export const emailSchema = z.string().trim().email('Enter a valid email address.').max(254);
export const otpSchema = z.string().regex(/^\d{6}$/, 'Enter the six-digit code.');
export const loginPasswordSchema = z
  .string()
  .min(1, 'Enter your password.')
  .max(1024, 'Password is too long.');
export const newPasswordSchema = loginPasswordSchema
  .min(8, 'Must be at least 8 characters.')
  .regex(
    /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/,
    'Must contain uppercase and lowercase letters, a number, and a symbol.',
  );

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Enter your name.')
  .max(50)
  .regex(/^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u, 'Enter a valid name.');
export const passwordsMatch = (value: { password: string; confirm_password: string }) =>
  value.password === value.confirm_password;
export const passwordMismatch = { path: ['confirm_password'], message: 'Passwords do not match.' };

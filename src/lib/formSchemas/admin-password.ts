import { z } from 'zod';

export const ADMIN_PASSWORD_MIN_LENGTH = 12;
export const ADMIN_PASSWORD_MAX_LENGTH = 128;

export const newAdminPasswordSchema = z
  .string({ error: 'Enter an unlock password.' })
  .min(ADMIN_PASSWORD_MIN_LENGTH, `Use at least ${ADMIN_PASSWORD_MIN_LENGTH} characters.`)
  .max(ADMIN_PASSWORD_MAX_LENGTH, `Use at most ${ADMIN_PASSWORD_MAX_LENGTH} characters.`);

export function parseNewAdminPassword(input: unknown): string {
  const parsed = newAdminPasswordSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  return parsed.data;
}

export function parseOptionalNewAdminPassword(input: unknown): string | null {
  return input === null || input === '' ? null : parseNewAdminPassword(input);
}

export const adminUnlockSchema = z.object({ password: z.string().min(1).max(1024) }).strict();

export const adminPasswordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current unlock password.').max(1024),
    password: newAdminPasswordSchema,
    confirmation: z
      .string()
      .min(1, 'Confirm your new unlock password.')
      .max(ADMIN_PASSWORD_MAX_LENGTH),
  })
  .strict()
  .refine((input) => input.password === input.confirmation, {
    path: ['confirmation'],
    message: 'The new passwords do not match.',
  })
  .refine((input) => input.password !== input.currentPassword, {
    path: ['password'],
    message: 'Choose a different unlock password.',
  });

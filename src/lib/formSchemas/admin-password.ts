import { z } from 'zod';

export const adminUnlockSchema = z.object({ password: z.string().min(1).max(1024) }).strict();

export const adminPasswordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current unlock password.').max(1024),
    password: z
      .string()
      .min(12, 'Use at least 12 characters.')
      .max(128, 'Use at most 128 characters.'),
    confirmation: z.string().min(1, 'Confirm your new unlock password.').max(128),
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

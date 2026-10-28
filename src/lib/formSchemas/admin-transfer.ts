import { z } from 'zod';
import { emailSchema, otpSchema } from './auth-fields';
import {
  adminUnlockSchema,
  newAdminPasswordSchema,
  ADMIN_PASSWORD_MAX_LENGTH,
} from './admin-password';

export const adminTransferIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export const adminTransferStartSchema = z
  .object({
    currentAdminPassword: adminUnlockSchema.shape.password,
    targetCodexUserId: z.uuid('Enter a valid target user ID.'),
    targetEmail: emailSchema,
  })
  .strict();

export const adminTransferAcceptanceSchema = z
  .object({
    challengeId: adminTransferIdSchema,
    otp: otpSchema,
    password: newAdminPasswordSchema,
    confirmation: z.string().min(1, 'Confirm your unlock password.').max(ADMIN_PASSWORD_MAX_LENGTH),
    acceptOwnership: z.literal(true, { error: 'Confirm that you accept ownership.' }),
  })
  .strict()
  .refine((input) => input.password === input.confirmation, {
    path: ['confirmation'],
    message: 'The new passwords do not match.',
  });

import { z } from 'zod';
import {
  emailSchema,
  otpSchema,
  newPasswordSchema,
  passwordsMatch,
  passwordMismatch,
} from './auth-fields';

export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    otp: otpSchema,
    password: newPasswordSchema,
    confirm_password: newPasswordSchema,
  })
  .refine(passwordsMatch, passwordMismatch);
export type resetPasswordSchemaType = z.infer<typeof resetPasswordSchema>;

import { z } from 'zod';
import {
  emailSchema,
  nameSchema,
  newPasswordSchema,
  passwordsMatch,
  passwordMismatch,
} from './auth-fields';

export const SignUpFormSchema = z.object({
  firstname: nameSchema,
  lastname: nameSchema,
  email: emailSchema,
  password: newPasswordSchema,
  confirm_password: newPasswordSchema,
  terms_and_policy: z.literal(true, { error: 'Accept terms and conditions to proceed.' }),
});
export const SignUpFormSchemaWithRefine = SignUpFormSchema.refine(passwordsMatch, passwordMismatch);
export type SignUpFormSchemaWithRefineType = z.infer<typeof SignUpFormSchemaWithRefine>;

import { z } from 'zod';
import { emailSchema, loginPasswordSchema } from './auth-fields';

export const signInSchema = z.object({ email: emailSchema, password: loginPasswordSchema });
export type signInSchemaType = z.infer<typeof signInSchema>;

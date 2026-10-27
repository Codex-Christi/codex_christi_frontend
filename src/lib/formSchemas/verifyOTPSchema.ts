import { z } from 'zod';
import { emailSchema, otpSchema } from './auth-fields';

export const verifyOTPSchema = z.object({ email: emailSchema, otp: otpSchema });
export type verifyOTPSchemaType = z.infer<typeof verifyOTPSchema>;

import { z } from 'zod';

export const verifyOTPSchema = z.object({
	email: z.string().email('Invalid email address.'),
	otp: z.string().length(6),
});

export type verifyOTPSchemaType = z.infer<typeof verifyOTPSchema>;

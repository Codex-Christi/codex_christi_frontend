import { z } from 'zod';

const stringField = (requiredMessage: string, invalidTypeMessage = requiredMessage) =>
  z.string({
    error: (issue) => (issue.input === undefined ? requiredMessage : invalidTypeMessage),
  });

export const resetPasswordSchema = z
	.object({
		otp: stringField("OTP is required", "OTP must be a string")
			.length(6, "OTP must be exactly 6 digits long")
			.refine((val) => /^\d{6}$/.test(val), {
				message: "OTP must be a valid 6-digit number",
			}),
		password: z
			.string()
			.trim()
			.regex(
				/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/,
				{
					message:
						"Must also contain an uppercase letter, a number, and a symbol",
				},
			),
		confirm_password: z
			.string()
			.trim()
			.regex(
				/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/,
				{
					message:
						"Must also contain an uppercase letter, a number, and a symbol",
				},
			),
	})
	.refine((data) => data.password === data.confirm_password, {
		path: ["confirm_password"],
		message: "Passwords do not match",
	});


export type resetPasswordSchemaType = z.infer<typeof resetPasswordSchema>;

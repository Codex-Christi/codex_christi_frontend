import { z } from 'zod';

export const resetPasswordSchema = z
	.object({
		otp: z
			.string({
				required_error: "OTP is required",
				invalid_type_error: "OTP must be a string",
			})
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

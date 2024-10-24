import { z } from 'zod';

export const resetPasswordSchema = z
	.object({
		email: z.string().email('Invalid email address.'),
		password: z
			.string()
			.trim()
			.regex(
				/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/,
				{
					message:
						'Must also contain an uppercase letter, a number, and a symbol',
				},
			),
		confirm_password: z
			.string()
			.trim()
			.regex(
				/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*-]).{8,}$/,
				{
					message:
						'Must also contain an uppercase letter, a number, and a symbol',
				},
			),
	});

export type resetPasswordSchemaType = z.infer<typeof resetPasswordSchema>;
